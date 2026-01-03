export const metadata = {
  title: "Pergudangan Link Hub — Pro",
  description: "Portal database link spreadsheet untuk tim pergudangan",
};

import "./../styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}