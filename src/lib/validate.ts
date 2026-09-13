/** Small validators. Helpful, not punitive: callers say what to fix and never clear input. */
export const required = (v: string) => v.trim().length > 0;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const isPhone = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

export const isZip = (v: string) => /^\d{5}(-\d{4})?$/.test(v.trim());

/** True when at least one contact method is present and well formed. */
export const hasPhoneOrEmail = (phone: string, email: string) => {
  const p = phone.trim();
  const e = email.trim();
  if (!p && !e) return false;
  if (p && !isPhone(p)) return false;
  if (e && !isEmail(e)) return false;
  return true;
};
