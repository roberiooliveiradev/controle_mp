# app/core/interfaces/product_notifier.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Optional


@dataclass(frozen=True)
class ProductCreatedEvent:
    product_id: int
    created_by: int
    created_at_iso: str
    codigo_atual: Optional[str] = None
    descricao: Optional[str] = None


@dataclass(frozen=True)
class ProductUpdatedEvent:
    product_id: int
    updated_by: int
    updated_at_iso: str
    codigo_atual: Optional[str] = None
    descricao: Optional[str] = None


@dataclass(frozen=True)
class ProductFlagChangedEvent:
    product_id: int
    field_id: int
    field_tag: str
    field_flag: Optional[str]
    changed_by: int
    changed_at_iso: str


class ProductNotifier(Protocol):
    def notify_product_created(self, event: ProductCreatedEvent) -> None: ...
    def notify_product_updated(self, event: ProductUpdatedEvent) -> None: ...
    def notify_product_flag_changed(self, event: ProductFlagChangedEvent) -> None: ...
