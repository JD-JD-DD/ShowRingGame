export default function Home() {
  return (
    <main
      style={{
        padding: "60px",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <button
        style={{
          fontSize: "28px",
          padding: "14px 28px",
          cursor: "pointer",
          marginBottom: "30px",
        }}
      >
        The ShowRing Game
      </button>

      <p style={{ fontSize: "18px" }}>
        An online dog show simulation.
      </p>

      <p
        style={{
          fontWeight: "bold",
          color: "red",
          fontSize: "18px",
          marginTop: "10px",
        }}
      >
        Alpha Development – In Progress
      </p>

      <br />
      <br />

      <p style={{ fontSize: "16px" }}>
        Click below to Enter.
      </p>

      <br />

      <a href="/generate-dog">
        <button
          style={{
            fontSize: "20px",
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          ENTER
        </button>
      </a>
    </main>
  );
}

