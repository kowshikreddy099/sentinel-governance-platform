from __future__ import annotations

from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    root_agent: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration: Mapped[str] = mapped_column(String(64), nullable=False, default="In progress")
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    risk_label: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    decisions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tools: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delegations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    violations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    anomaly: Mapped[str] = mapped_column(String(16), nullable=False, default="none")
    events: Mapped[list["TraceEvent"]] = relationship(back_populates="run", cascade="all, delete-orphan", order_by="TraceEvent.timestamp")


class TraceEvent(Base):
    __tablename__ = "trace_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    policy_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    risk_delta: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tool: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    run: Mapped[AgentRun] = relationship(back_populates="events")


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    matched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rule: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    trace_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    state: Mapped[str] = mapped_column(String(24), nullable=False, default="open")
