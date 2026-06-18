export const maskCpfCnpj = (value: string) => {
  if (!value) return "";
  return value.replace(/\D/g, "");
};

export const maskPhone = (value: string) => {
  if (!value) return "";
  let v = value.replace(/\D/g, "");
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d)(\d{4})$/, "$1-$2");
  return v;
};
