/**
 * medicationHelpers.ts — Pure utility functions for brand list manipulation.
 * Used by SearchList (Smart Picker), My Meds, and Medication Details views.
 */

export function parseBrands(brands: string | null | undefined): string[] {
  if (!brands) return [];
  return brands
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

export function reorderBrandsBySearch(
  brands: string[],
  searchTerm: string,
): string[] {
  if (!searchTerm.trim()) return brands;
  const q = searchTerm.trim().toLowerCase();
  const matching = brands.filter((b) => b.toLowerCase().includes(q));
  const nonMatching = brands.filter((b) => !b.toLowerCase().includes(q));
  return [...matching, ...nonMatching];
}

export function reorderBrandsBySelected(
  brands: string[],
  selectedBrand: string | null | undefined,
): string[] {
  if (!selectedBrand) return brands;
  const idx = brands.findIndex(
    (b) => b.toLowerCase() === selectedBrand.toLowerCase(),
  );
  if (idx <= 0) return brands;
  const [item] = brands.splice(idx, 1);
  return [item, ...brands];
}

export function formatBrandPreview(
  brands: string[],
  maxShow = 3,
): string {
  if (brands.length === 0) return "";
  if (brands.length <= maxShow) return brands.join(", ");
  const shown = brands.slice(0, maxShow).join(", ");
  const remaining = brands.length - maxShow;
  return `${shown} + ${remaining} more`;
}

export function formatBrandPreviewWithSelected(
  brands: string[],
  selectedBrand: string | null | undefined,
  maxShow = 3,
): string {
  const reordered = reorderBrandsBySelected(brands, selectedBrand);
  return formatBrandPreview(reordered, maxShow);
}