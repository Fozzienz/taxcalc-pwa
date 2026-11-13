/** First paint for the home screen, before the animated splash takes over. */
export function InstantBootSplash() {
  return (
    <div
      id="taxtrack-instant-boot-splash"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#070c18",
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/taxtrack-logo-dark.png" alt="" width={280} height={83} style={{ width: "min(280px, 72vw)", height: "auto" }} />
    </div>
  );
}
