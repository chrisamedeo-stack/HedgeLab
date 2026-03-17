"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHedgeBookStore } from "@/store/hedgeBookStore";
import { useSites } from "@/hooks/usePositions";
import { HedgeBookTabs } from "@/components/positions/HedgeBookTabs";
import { PositionSummaryCards } from "@/components/positions/PositionSummaryCards";
import { PipelineTabs } from "@/components/positions/PipelineTabs";
import { PositionTable } from "@/components/positions/PositionTable";
import { AllocateModal } from "@/components/positions/AllocateModal";
import { EFPModal } from "@/components/positions/EFPModal";
import { OffsetModalV2 } from "@/components/positions/OffsetModalV2";
import { ExerciseModal } from "@/components/positions/ExerciseModal";
import { SplitModal } from "@/components/positions/SplitModal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { Position, PipelineTab } from "@/types/positions";

export default function PositionManagerPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { user } = useAuth();
  const { data: sites } = useSites(orgId);

  const {
    books, activeBookId, positions, summary, activeTab, loading,
    fetchBooks, setActiveBook, setActiveTab, fetchPositions, fetchSummary,
    allocatePosition, executeEFP, executeOffset, exerciseOption, expireOption, splitPosition,
  } = useHedgeBookStore();

  // Modal state
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalPosition, setModalPosition] = useState<Position | null>(null);

  // Load books on mount
  useEffect(() => {
    if (orgId) fetchBooks(orgId);
  }, [orgId, fetchBooks]);

  // Load positions + summary when book or tab changes
  useEffect(() => {
    if (activeBookId) {
      fetchPositions(activeBookId, activeTab);
      fetchSummary(activeBookId);
    }
  }, [activeBookId, activeTab, fetchPositions, fetchSummary]);

  const activeBook = books.find((b) => b.id === activeBookId);

  // ─── Action handler ─────────────────────────────────────────────────
  const handleAction = useCallback(
    (positionId: string, action: string) => {
      const pos = positions.find((p) => p.id === positionId);
      if (!pos) return;
      setModalPosition(pos);
      setModalAction(action);
    },
    [positions]
  );

  const closeModal = useCallback(() => {
    setModalAction(null);
    setModalPosition(null);
  }, []);

  const handleTabChange = useCallback(
    (tab: PipelineTab) => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Position Manager
        </h1>
        <p className="mt-0.5 text-xs text-faint">
          Unified position pipeline — allocate, EFP, offset, exercise, and expire
        </p>
      </div>

      {/* Book tabs */}
      <HedgeBookTabs
        books={books}
        activeBookId={activeBookId}
        onSelect={setActiveBook}
      />

      {/* Summary cards */}
      <PositionSummaryCards summary={summary} currency={activeBook?.currency} />

      {/* Pipeline tabs */}
      <PipelineTabs active={activeTab} onChange={handleTabChange} />

      {/* Position table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : (
        <PositionTable
          positions={positions}
          tab={activeTab}
          onAction={handleAction}
        />
      )}

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      {(modalAction === "allocate_budget" || modalAction === "allocate_site") && (
        <AllocateModal
          position={modalPosition}
          sites={sites ?? []}
          onSubmit={async (params) => {
            await allocatePosition(modalPosition!.id, { userId: user!.id, ...params });
          }}
          onClose={closeModal}
        />
      )}

      {modalAction === "efp" && (
        <EFPModal
          position={modalPosition}
          onSubmit={async (params) => {
            await executeEFP(modalPosition!.id, { userId: user!.id, ...params });
          }}
          onClose={closeModal}
        />
      )}

      {modalAction === "offset" && (
        <OffsetModalV2
          position={modalPosition}
          onSubmit={async (params) => {
            await executeOffset(modalPosition!.id, { userId: user!.id, ...params });
          }}
          onClose={closeModal}
        />
      )}

      {modalAction === "exercise" && (
        <ExerciseModal
          position={modalPosition}
          onSubmit={async (params) => {
            await exerciseOption(modalPosition!.id, { userId: user!.id, ...params });
          }}
          onClose={closeModal}
        />
      )}

      {modalAction === "expire" && modalPosition && (
        <ExerciseModal
          position={modalPosition}
          onSubmit={async (params) => {
            await expireOption(modalPosition!.id, {
              userId: user!.id,
              expiryDate: params.exerciseDate,
            });
          }}
          onClose={closeModal}
        />
      )}

      {modalAction === "split" && (
        <SplitModal
          position={modalPosition}
          sites={sites ?? []}
          onSubmit={async (params) => {
            await splitPosition(modalPosition!.id, { userId: user!.id, ...params });
          }}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
