"""OpenTelemetry helpers for governance spans and propagation metadata."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from .config import get_settings


def configure_telemetry() -> None:
    """Install a provider once; OTLP export is enabled only when configured."""
    provider = TracerProvider(resource=Resource.create({"service.name": "sentinel-governance-api"}))
    endpoint = get_settings().otel_exporter_otlp_endpoint
    if endpoint:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True)))
    trace.set_tracer_provider(provider)


@contextmanager
def governance_span(name: str, attributes: dict[str, str | int | bool]) -> Iterator[None]:
    """Create a span without coupling policy evaluation to an exporter."""
    tracer = trace.get_tracer("sentinel.governance")
    with tracer.start_as_current_span(name) as span:
        for key, value in attributes.items():
            span.set_attribute(key, value)
        yield
