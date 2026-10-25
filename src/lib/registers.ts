import type { AppData, Register, Role, Store } from '../types'

/** レジが 1 つもないときに自動で作る、代表者のレジの名前（spec-next.md「レジ」） */
export const DEFAULT_REGISTER_NAME = 'マイレジ'

/** 役割の表示（spec-next.md「役割」） */
export const ROLE_LABEL: Record<Role, string> = { owner: '代表者', member: '会計' }

type RegisterInit = Partial<AppData> & {
  name: string
  role?: Role
  myName?: string
  /** 会計する人のレジでは、配られた店の印を使う。省くと新しく振る */
  storeId?: string
}

/** 新しいレジを作る。ID は crypto.randomUUID() で振る */
export function createRegister({ name, role = 'owner', myName = '', storeId, products = [], sales = [] }: RegisterInit): Register {
  return { id: crypto.randomUUID(), storeId: storeId ?? crypto.randomUUID(), name, role, myName, products, sales }
}

/** レジが 1 つだけの、新しい保存データ。MVP の保存データ（商品と会計）を引き継ぐときにも使う */
export function storeWith(data: Partial<AppData> = {}): Store {
  const register = createRegister({ name: DEFAULT_REGISTER_NAME, ...data })
  return { registers: [register], currentId: register.id }
}

/** 今使っているレジ。currentId がどのレジとも合わないときは、最初のレジ */
export function currentRegister(store: Store): Register {
  return store.registers.find((r) => r.id === store.currentId) ?? store.registers[0]
}

/**
 * 今使っているレジを変える。update が同じレジを返したら、同じ保存データを返す（保存し直さない）
 */
export function updateCurrent(store: Store, update: (register: Register) => Register): Store {
  const current = currentRegister(store)
  const next = update(current)
  if (next === current) return store
  return { ...store, registers: store.registers.map((r) => (r === current ? next : r)) }
}

/** 今使うレジを切り替える。ない ID や、もう今のレジなら、同じ保存データを返す */
export function switchRegister(store: Store, id: string): Store {
  if (id === store.currentId || !store.registers.some((r) => r.id === id)) return store
  return { ...store, currentId: id }
}

/** レジを一覧の末尾に足し、そのレジに切り替える */
export function addRegister(store: Store, register: Register): Store {
  return { registers: [...store.registers, register], currentId: register.id }
}

/**
 * レジを削除する。ない ID なら同じ保存データを返す
 * 今のレジを消したら、一覧の最初のレジに切り替える。最後の 1 つを消したら、マイレジを自動で作る（spec-next.md「レジ」）
 */
export function deleteRegister(store: Store, id: string): Store {
  if (!store.registers.some((r) => r.id === id)) return store
  const registers = store.registers.filter((r) => r.id !== id)
  if (registers.length === 0) return storeWith()
  return { registers, currentId: registers.some((r) => r.id === store.currentId) ? store.currentId : registers[0].id }
}

/**
 * 配られた商品を取り込んだ結果（spec-next.md「商品を配る」）
 * - added：会計する人のレジとして足した
 * - updated：同じ店の会計する人のレジの商品を置き換えた
 * - own：同じ店の代表者のレジ（自分で配ったもの）なので取り込まない
 */
export type ImportProductsResult = 'added' | 'updated' | 'own'

/** 自動で作ったまま、何も入っていないマイレジか（商品も会計も自分の名前もない代表者のレジ） */
function isUntouched(r: Register): boolean {
  return r.role === 'owner' && r.name === DEFAULT_REGISTER_NAME && r.myName === '' && r.products.length === 0 && r.sales.length === 0
}

/** 配られた商品の店のレジが、この端末にあれば返す */
export function findStoreRegister(store: Store, storeId: string): Register | undefined {
  return store.registers.find((r) => r.storeId === storeId)
}

/**
 * 配られた商品を取り込む。同じ店のレジがなければ、会計する人のレジとして足して切り替える
 * 同じ店の会計する人のレジがあれば、商品の一覧とレジの名前を置き換えて切り替える（会計は残す）。代表者のレジなら何もしない
 */
export function importProducts(
  store: Store,
  share: { storeId: string; name: string; products: AppData['products'] },
  myName: string,
): { store: Store; result: ImportProductsResult } {
  const existing = findStoreRegister(store, share.storeId)
  if (existing?.role === 'owner') return { store, result: 'own' }
  if (existing) {
    const updated = { ...existing, name: share.name, products: share.products }
    return { store: { registers: store.registers.map((r) => (r === existing ? updated : r)), currentId: existing.id }, result: 'updated' }
  }
  const register = createRegister({ name: share.name, role: 'member', myName, storeId: share.storeId, products: share.products })
  // 自動で作ったまま何も入っていないマイレジしかなければ、残さずに置き換える
  if (store.registers.length === 1 && isUntouched(store.registers[0])) return { store: { registers: [register], currentId: register.id }, result: 'added' }
  return { store: addRegister(store, register), result: 'added' }
}
