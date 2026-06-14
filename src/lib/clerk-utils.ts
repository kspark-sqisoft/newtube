export function formatClerkName(data: {
  first_name: string | null;
  last_name: string | null;
}) {
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || "User";
}
