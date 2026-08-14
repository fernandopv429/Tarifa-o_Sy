export const maskCpfCnpj = (value: string) => {
  if (!value) return "";
  return value.replace(/\D/g, "");
};

export const maskPhone = (value: string) => {
  if (!value) return "";
  let v = value.replace(/\D/g, "");
  if (v.startsWith("55")) v = v.substring(2);
  if (v.length > 11) v = v.substring(0, 11);
  
  if (v.length === 0) return "";
  if (v.length <= 2) return `+55 ${v}`;
  if (v.length <= 7) return `+55 ${v.substring(0, 2)} ${v.substring(2)}`;
  return `+55 ${v.substring(0, 2)} ${v.substring(2, 7)}-${v.substring(7)}`;
};
