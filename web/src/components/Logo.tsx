export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="lp-brand-mark" style={{ width: size, height: size }}>
      <img src="/logomark.svg" width={size} height={size} alt="Shunt logo" />
    </span>
  );
}
