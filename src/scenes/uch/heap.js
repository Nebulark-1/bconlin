/** A binary min-heap, ordered by `less`. Used for the planner's open set. */
export function createHeap(less = (a, b) => a.t < b.t) {
  const a = [];
  const swap = (i, j) => ([a[i], a[j]] = [a[j], a[i]]);
  return {
    push(item) {
      a.push(item);
      for (let i = a.length - 1, p; i > 0 && less(a[i], a[(p = (i - 1) >> 1)]); i = p) swap(i, p);
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        for (let i = 0; ; ) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && less(a[l], a[m])) m = l;
          if (r < a.length && less(a[r], a[m])) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
    get size() {
      return a.length;
    },
  };
}
