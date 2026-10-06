package main

import (
	"testing"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/google/uuid"
	"github.com/prometheus/prometheus/prompb"
)

// TestBuildWriteRequestRoundTrip constructs a WriteRequest from a fake probe
// result, marshals + snappy-compresses it exactly the way push() does, then
// decompresses + unmarshals it back and asserts every label/sample value
// survives the round trip unchanged.
func TestBuildWriteRequestRoundTrip(t *testing.T) {
	c := checkRow{
		ID:              uuid.New(),
		TenantID:        uuid.New(),
		Name:            "checkout-api",
		URL:             "https://example.com/health",
		IntervalSeconds: 60,
	}
	ts := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	wantTimestampMs := ts.UnixMilli()

	wr, err := buildWriteRequest(c, true, 0.125, ts)
	if err != nil {
		t.Fatalf("buildWriteRequest: %v", err)
	}

	compressed, err := encodeWriteRequest(wr)
	if err != nil {
		t.Fatalf("encodeWriteRequest: %v", err)
	}

	decompressed, err := snappy.Decode(nil, compressed)
	if err != nil {
		t.Fatalf("snappy.Decode: %v", err)
	}

	var got prompb.WriteRequest
	if err := proto.Unmarshal(decompressed, &got); err != nil {
		t.Fatalf("proto.Unmarshal: %v", err)
	}

	if len(got.Timeseries) != 2 {
		t.Fatalf("got %d timeseries, want 2", len(got.Timeseries))
	}

	byName := map[string]prompb.TimeSeries{}
	for _, ts := range got.Timeseries {
		var name string
		for _, l := range ts.Labels {
			if l.Name == "__name__" {
				name = l.Value
			}
		}
		byName[name] = ts
	}

	success, ok := byName["probe_success"]
	if !ok {
		t.Fatal("missing probe_success timeseries")
	}
	assertLabel(t, success.Labels, "check_id", c.ID.String())
	assertLabel(t, success.Labels, "check_name", c.Name)
	if len(success.Samples) != 1 {
		t.Fatalf("probe_success: got %d samples, want 1", len(success.Samples))
	}
	if success.Samples[0].Value != 1.0 {
		t.Errorf("probe_success value = %v, want 1.0", success.Samples[0].Value)
	}
	if success.Samples[0].Timestamp != wantTimestampMs {
		t.Errorf("probe_success timestamp = %v, want %v", success.Samples[0].Timestamp, wantTimestampMs)
	}

	duration, ok := byName["probe_duration_seconds"]
	if !ok {
		t.Fatal("missing probe_duration_seconds timeseries")
	}
	assertLabel(t, duration.Labels, "check_id", c.ID.String())
	assertLabel(t, duration.Labels, "check_name", c.Name)
	if len(duration.Samples) != 1 {
		t.Fatalf("probe_duration_seconds: got %d samples, want 1", len(duration.Samples))
	}
	if duration.Samples[0].Value != 0.125 {
		t.Errorf("probe_duration_seconds value = %v, want 0.125", duration.Samples[0].Value)
	}
	if duration.Samples[0].Timestamp != wantTimestampMs {
		t.Errorf("probe_duration_seconds timestamp = %v, want %v", duration.Samples[0].Timestamp, wantTimestampMs)
	}
}

// TestBuildWriteRequestFailure covers the failed-probe case -- success must
// encode as 0, not just "not 1".
func TestBuildWriteRequestFailure(t *testing.T) {
	c := checkRow{ID: uuid.New(), TenantID: uuid.New(), Name: "down-check"}
	wr, err := buildWriteRequest(c, false, 8.0, time.Now())
	if err != nil {
		t.Fatalf("buildWriteRequest: %v", err)
	}
	for _, ts := range wr.Timeseries {
		for _, l := range ts.Labels {
			if l.Name == "__name__" && l.Value == "probe_success" {
				if ts.Samples[0].Value != 0.0 {
					t.Errorf("probe_success value = %v, want 0.0 for a failed probe", ts.Samples[0].Value)
				}
			}
		}
	}
}

func assertLabel(t *testing.T, labels []prompb.Label, name, want string) {
	t.Helper()
	for _, l := range labels {
		if l.Name == name {
			if l.Value != want {
				t.Errorf("label %s = %q, want %q", name, l.Value, want)
			}
			return
		}
	}
	t.Errorf("missing label %s", name)
}
