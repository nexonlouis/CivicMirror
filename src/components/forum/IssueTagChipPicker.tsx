"use client";

import { getIssueTagLabel } from "@/lib/constants/issue-tags";

export function toggleSlugSelection(selected: string[], slug: string): string[] {
  return selected.includes(slug)
    ? selected.filter((s) => s !== slug)
    : [...selected, slug];
}

interface IssueTagChipPickerProps {
  availableSlugs: string[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  label?: string;
  hint?: string;
  showAllOption?: boolean;
  allLabel?: string;
}

export function IssueTagChipPicker({
  availableSlugs,
  selectedSlugs,
  onChange,
  label,
  hint,
  showAllOption = false,
  allLabel = "All issues",
}: IssueTagChipPickerProps) {
  if (availableSlugs.length === 0) return null;

  return (
    <div>
      {label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
      )}
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {showAllOption && (
          <Chip
            active={selectedSlugs.length === 0}
            label={allLabel}
            onClick={() => onChange([])}
          />
        )}
        {availableSlugs.map((slug) => (
          <Chip
            key={slug}
            active={selectedSlugs.includes(slug)}
            label={getIssueTagLabel(slug)}
            onClick={() => onChange(toggleSlugSelection(selectedSlugs, slug))}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
