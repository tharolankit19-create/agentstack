import { TESTIMONIALS } from "@/lib/testimonials";

/**
 * Renders nothing until there are real quotes in `lib/testimonials.ts`.
 *
 * An empty section beats a fabricated one: proof that turns out to be invented
 * costs more trust than having none did.
 */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="border-b border-line bg-surface-2 px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          What people say after a week.
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={`${testimonial.name}-${testimonial.quote.slice(0, 24)}`}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <blockquote className="text-lg leading-relaxed">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {testimonial.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={testimonial.avatarUrl}
                    alt=""
                    className="size-9 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <div className="text-sm font-bold">{testimonial.name}</div>
                  {testimonial.role ? (
                    <div className="text-sm text-muted">
                      {testimonial.role}
                    </div>
                  ) : null}
                </div>
                {testimonial.handle ? (
                  <a
                    href={`https://x.com/${testimonial.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-sm font-medium text-faint hover:text-fg"
                  >
                    @{testimonial.handle}
                  </a>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
