import Image from 'next/image'

export function BrandLockup({
  size = 44,
  subtitle,
  inverse = false,
  className = '',
}: {
  size?: number
  subtitle?: string
  inverse?: boolean
  className?: string
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src="/favicon.png"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-xl object-cover ring-1 ring-black/10"
      />
      <span className="min-w-0">
        <span className={`block truncate text-[15px] font-semibold tracking-tight ${inverse ? 'text-white' : 'text-slate-900'}`}>
          360° Resolver
        </span>
        {subtitle && (
          <span className={`mt-0.5 block truncate text-[10px] ${inverse ? 'text-slate-400' : 'text-slate-500'}`}>
            {subtitle}
          </span>
        )}
      </span>
    </div>
  )
}
