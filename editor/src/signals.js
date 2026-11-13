export const opposite = (value) => (value === 0 ? 1 : value === 1 ? 0 : null);
export const color = (value) =>
  value === 0 ? "#276eaf" : value === 1 ? "#b97713" : "#92a0b0";
export const strandColor = (value, rail) =>
  color(rail === 0 ? value : opposite(value));
