function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "??";
}

export function Avatar({
  avatarUrl,
  initials,
  nickname,
  size = "md",
  shape = "circle",
}: {
  avatarUrl?: string | null;
  initials?: string;
  nickname: string;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "squircle";
}) {
  return (
    <div className={`ig-avatar ig-avatar-${size} ${shape === "squircle" ? "ig-avatar-squircle" : ""}`} title={nickname}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={nickname} loading="lazy" />
      ) : (
        initials || getInitials(nickname)
      )}
    </div>
  );
}
