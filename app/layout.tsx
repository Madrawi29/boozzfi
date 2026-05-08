import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "B00ZZ FI",
  description: "Blue Flame DeFi Suite on Arc Testnet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}