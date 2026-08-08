import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Visual Representation Lab", description: "Architecture representation-variable experiment workspace" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
