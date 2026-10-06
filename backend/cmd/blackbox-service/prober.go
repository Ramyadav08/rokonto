// Prober logic: issuing synthetic HTTP probes and encoding the results as a
// Prometheus remote_write request. The "build a WriteRequest from a probe
// result" step is factored out as a pure function (buildWriteRequest) so it
// can be unit tested without a network call or a running Mimir.
package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/prometheus/prompb"

	"observex/backend/internal/tenancy"
)

// schedulerTick is how often the background loop wakes up to check which
// checks are due. Independent of any individual check's own interval --
// each check's interval is enforced against the in-memory lastProbed map,
// not by varying how often this loop itself runs.
const schedulerTick = 15 * time.Second

// probeTimeout bounds how long a single probe's HTTP GET is allowed to take.
// A hung upstream must never stall the whole tick.
const probeTimeout = 8 * time.Second

// checkRow is the registry row this service probes against -- one per
// synthetic_checks row.
type checkRow struct {
	ID              uuid.UUID
	TenantID        uuid.UUID
	Name            string
	URL             string
	IntervalSeconds int
}

// prober owns the in-memory "when was each check last probed" state and the
// dependencies needed to run probes and ship results to Mimir. Tracking
// lastProbed in memory (rather than a DB column) is a deliberate choice: it
// avoids a schema change, and losing this state on restart just means a
// missed probe or two, which is not a correctness problem for uptime
// monitoring.
type prober struct {
	pool       *pgxpool.Pool
	httpClient *http.Client
	mimirURL   string

	mu         sync.Mutex
	lastProbed map[uuid.UUID]time.Time
}

func newProber(pool *pgxpool.Pool, mimirURL string) *prober {
	return &prober{
		pool:       pool,
		httpClient: &http.Client{Timeout: probeTimeout},
		mimirURL:   mimirURL,
		lastProbed: make(map[uuid.UUID]time.Time),
	}
}

// run blocks forever, ticking every schedulerTick and processing whatever
// checks are due. Intended to be launched in its own goroutine alongside the
// HTTP server.
func (p *prober) run(ctx context.Context) {
	ticker := time.NewTicker(schedulerTick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.tick(ctx)
		}
	}
}

// tick loads every registered check and probes whichever ones are due. One
// check's failure (DB error aside, which aborts the whole tick since there's
// nothing to iterate) never stops the others in the same tick -- each
// check's probe+push is wrapped in its own recover/log boundary.
func (p *prober) tick(ctx context.Context) {
	checks, err := p.loadChecks(ctx)
	if err != nil {
		log.Printf("blackbox: loading checks: %v", err)
		return
	}

	now := time.Now()
	for _, c := range checks {
		if !p.isDue(c, now) {
			continue
		}
		p.processCheck(ctx, c, now)
	}
}

func (p *prober) isDue(c checkRow, now time.Time) bool {
	p.mu.Lock()
	last, ok := p.lastProbed[c.ID]
	p.mu.Unlock()
	if !ok {
		return true
	}
	interval := time.Duration(c.IntervalSeconds) * time.Second
	return now.Sub(last) >= interval
}

func (p *prober) markProbed(id uuid.UUID, at time.Time) {
	p.mu.Lock()
	p.lastProbed[id] = at
	p.mu.Unlock()
}

// processCheck runs one check's probe and push, recovering from any panic so
// a single bad check can never take down the tick loop or the service.
func (p *prober) processCheck(ctx context.Context, c checkRow, now time.Time) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("blackbox: panic probing check %s (%s): %v", c.ID, c.Name, r)
		}
	}()

	p.markProbed(c.ID, now)

	success, duration := p.probe(ctx, c.URL)

	wr, err := buildWriteRequest(c, success, duration, now)
	if err != nil {
		log.Printf("blackbox: building write request for check %s (%s): %v", c.ID, c.Name, err)
		return
	}

	if err := p.push(ctx, c.TenantID, wr); err != nil {
		log.Printf("blackbox: pushing result for check %s (%s): %v", c.ID, c.Name, err)
		return
	}
}

// probe issues the HTTP GET and reports success (2xx) and wall-clock
// duration in seconds. Any transport-level error (timeout, DNS failure,
// connection refused, etc.) counts as a failed probe rather than crashing
// the loop.
func (p *prober) probe(ctx context.Context, url string) (success bool, durationSeconds float64) {
	reqCtx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	start := time.Now()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return false, time.Since(start).Seconds()
	}

	resp, err := p.httpClient.Do(req)
	duration := time.Since(start).Seconds()
	if err != nil {
		return false, duration
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300, duration
}

func (p *prober) loadChecks(ctx context.Context) ([]checkRow, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, tenant_id, name, url, interval_seconds FROM synthetic_checks`)
	if err != nil {
		return nil, fmt.Errorf("querying synthetic_checks: %w", err)
	}
	defer rows.Close()

	var checks []checkRow
	for rows.Next() {
		var c checkRow
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.URL, &c.IntervalSeconds); err != nil {
			return nil, fmt.Errorf("scanning synthetic_checks row: %w", err)
		}
		checks = append(checks, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating synthetic_checks: %w", err)
	}
	return checks, nil
}

// buildWriteRequest constructs the prompb.WriteRequest for one probe
// result -- two timeseries, probe_success and probe_duration_seconds, both
// labeled with check_id/check_name and timestamped at ts. Pure and
// side-effect free so it's directly unit-testable.
func buildWriteRequest(c checkRow, success bool, durationSeconds float64, ts time.Time) (*prompb.WriteRequest, error) {
	successValue := 0.0
	if success {
		successValue = 1.0
	}
	timestampMs := ts.UnixMilli()

	labels := []prompb.Label{
		{Name: "check_id", Value: c.ID.String()},
		{Name: "check_name", Value: c.Name},
	}

	return &prompb.WriteRequest{
		Timeseries: []prompb.TimeSeries{
			{
				Labels: append([]prompb.Label{{Name: "__name__", Value: "probe_success"}}, labels...),
				Samples: []prompb.Sample{
					{Value: successValue, Timestamp: timestampMs},
				},
			},
			{
				Labels: append([]prompb.Label{{Name: "__name__", Value: "probe_duration_seconds"}}, labels...),
				Samples: []prompb.Sample{
					{Value: durationSeconds, Timestamp: timestampMs},
				},
			},
		},
	}, nil
}

// encodeWriteRequest marshals a WriteRequest with the gogo protobuf
// implementation prompb's generated types actually satisfy (confirmed by
// reading prompb/remote.pb.go's imports -- it generates against
// github.com/gogo/protobuf/proto, not google.golang.org/protobuf), then
// snappy-compresses the result the way the remote_write wire protocol
// requires.
func encodeWriteRequest(wr *prompb.WriteRequest) ([]byte, error) {
	data, err := proto.Marshal(wr)
	if err != nil {
		return nil, fmt.Errorf("marshaling write request: %w", err)
	}
	return snappy.Encode(nil, data), nil
}

// push sends an already-built WriteRequest to Mimir's remote_write endpoint,
// scoped to the owning tenant via X-Scope-OrgID -- the same header and
// derivation every other write path in this system uses, never anything
// client-supplied.
func (p *prober) push(ctx context.Context, tenantID uuid.UUID, wr *prompb.WriteRequest) error {
	compressed, err := encodeWriteRequest(wr)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.mimirURL+"/api/v1/push", bytes.NewReader(compressed))
	if err != nil {
		return fmt.Errorf("building remote_write request: %w", err)
	}
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(tenantID))

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending remote_write request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("remote_write returned status %d", resp.StatusCode)
	}
	return nil
}
