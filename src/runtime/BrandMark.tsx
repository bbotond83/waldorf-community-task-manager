import Image from "next/image";
import Link from "next/link";

export const BRAND_NAME = "Cinkotai Waldorf Óvoda";

/** Kindergarten logo; links to the start page unless `linked` is false. */
export function BrandMark({ linked = true, size = 56 }: { linked?: boolean; size?: number }) {
  const image = (
    <Image
      className="brand-mark"
      src="/brand/logo.png"
      alt={BRAND_NAME}
      width={size}
      height={size}
      priority
    />
  );
  if (!linked) return image;
  return (
    <Link className="brand-link" href="/" data-testid="brand-link">
      {image}
    </Link>
  );
}
