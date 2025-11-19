export function correctItemSize(el: HTMLElement, dimension: 'height' | 'width') {
  return Math.round(el.getBoundingClientRect()[dimension])
}

export function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}