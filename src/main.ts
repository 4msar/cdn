import './style.css'

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)
const $$ = <T extends HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)]

// Copy buttons next to code blocks.
for (const button of $$<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', async () => {
    const text = button.parentElement?.querySelector('pre')?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Press ⌘C'
    }
    setTimeout(() => (button.textContent = 'Copy'), 1500)
  })
}

// Range inputs that drive a CSS variable on the page (specimen tester).
for (const input of $$<HTMLInputElement>('input[data-var]')) {
  const apply = () => {
    document.documentElement.style.setProperty(input.dataset.var!, input.value + (input.dataset.unit ?? ''))
    const output = input.parentElement?.querySelector('output')
    if (output) output.textContent = input.value
  }
  input.addEventListener('input', apply)
  apply()
}

// Catalogue: load each family only when its row nears the viewport.
const samples = $$('.row-sample')
if (samples.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.style.fontFamily = el.dataset.font!
        observer.unobserve(el)
      }
    },
    { rootMargin: '600px 0px' },
  )
  samples.forEach((el) => observer.observe(el))

  const search = $<HTMLInputElement>('#search')
  const preview = $<HTMLInputElement>('#preview')
  const size = $<HTMLInputElement>('#size')
  const empty = $('#empty')

  search?.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase()
    let shown = 0
    for (const row of $$('.row')) {
      const match = row.dataset.name!.includes(query)
      row.hidden = !match
      if (match) shown++
    }
    if (empty) empty.hidden = shown > 0
  })

  preview?.addEventListener('input', () => {
    for (const el of samples) el.textContent = preview.value || el.dataset.default!
  })

  const setSize = () => document.documentElement.style.setProperty('--row-size', `${size!.value}px`)
  size?.addEventListener('input', setSize)
}
