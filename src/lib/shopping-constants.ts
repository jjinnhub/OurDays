/** 장바구니 리스트 (다이소, 롯데마트, 식재료 ...) */
export type ShoppingList = {
  id: string;
  family_id: string;
  name: string;
  created_by: string;
  created_at: string;
};

/** 장바구니 항목 — quantity는 "2", "1kg", "3팩" 같은 자유 텍스트 */
export type ShoppingItem = {
  id: string;
  list_id: string;
  family_id: string;
  name: string;
  quantity: string;
  memo: string;
  created_by: string;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
};
