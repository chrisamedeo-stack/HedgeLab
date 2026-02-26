"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import { btnPrimary } from "@/lib/corn-format";

const schema = z.object({
  quantity:        z.coerce.number().positive().optional(),
  fixedPrice:      z.coerce.number().positive().optional(),
  startDate:       z.string().optional(),
  endDate:         z.string().optional(),
  amendmentReason: z.string().min(5, "Reason must be at least 5 characters"),
});

type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full bg-input-bg border border-b-input text-primary placeholder:text-ph rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

export default function AmendTradePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined && v !== "")
    );
    await api.put(`/api/v1/trades/${id}/amend`, payload);
    router.push(`/trades/${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/trades/${id}`} className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Trade Detail
        </Link>
        <h1 className="text-xl font-bold text-primary">Amend Trade</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
        <p className="text-sm text-faint">Only fill in the fields you want to change.</p>

        <Field label="New Quantity" error={errors.quantity?.message}>
          <input type="number" step="0.000001" {...register("quantity")}
            className={inputClass} placeholder="Leave blank to keep current" />
        </Field>

        <Field label="New Fixed Price" error={errors.fixedPrice?.message}>
          <input type="number" step="0.000001" {...register("fixedPrice")}
            className={inputClass} placeholder="Leave blank to keep current" />
        </Field>

        <Field label="New Start Date" error={errors.startDate?.message}>
          <input type="date" {...register("startDate")} className={inputClass} />
        </Field>

        <Field label="New End Date" error={errors.endDate?.message}>
          <input type="date" {...register("endDate")} className={inputClass} />
        </Field>

        <Field label="Amendment Reason *" error={errors.amendmentReason?.message}>
          <textarea rows={3} {...register("amendmentReason")}
            className={inputClass} placeholder="Describe the reason for this amendment" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={btnPrimary}
          >
            {isSubmitting ? "Submitting\u2026" : "Submit Amendment"}
          </button>
          <Link
            href={`/trades/${id}`}
            className="px-4 py-2 border border-b-input text-secondary rounded-lg text-sm hover:bg-input-bg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
