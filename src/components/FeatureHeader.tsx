import Link from "next/link";

type FeatureHeaderProps = {
  title: string;
};

export function FeatureHeader({ title }: FeatureHeaderProps) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 16,
        justifyContent: "space-between",
        marginBottom: 24,
      }}
    >
      <h1 style={{ margin: 0 }}>{title}</h1>
      <Link
        href="/"
        style={{
          background: "#e5f0ff",
          borderRadius: 8,
          color: "#0d3fbd",
          fontWeight: 800,
          padding: "10px 14px",
          textDecoration: "none",
        }}
      >
        Back
      </Link>
    </div>
  );
}
