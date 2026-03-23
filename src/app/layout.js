// src/app/layout.js
export const metadata = {
  title: "RWS Command Center",
  description: "Rogers Web Solutions — ops.rogers-websolutions.com",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#07080b" }}>
        {children}
      </body>
    </html>
  );
}
