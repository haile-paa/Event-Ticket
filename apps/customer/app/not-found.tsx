import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center px-6 py-32 text-center">
      <p className="text-gradient font-display text-8xl font-extrabold">404</p>
      <h1 className="mt-4 text-3xl font-extrabold">This page left early</h1>
      <p className="mt-2 text-fog-400">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-8">Back to events</Link>
    </div>
  );
}
