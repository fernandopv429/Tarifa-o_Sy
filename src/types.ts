export type UserRole = 'LOCADOR_MASTER' | 'LOCADOR' | 'LOCATARIO_MASTER' | 'LOCATARIO';

export interface AuthUser {
  success: boolean;
  user: string;
  nome: string;
  role: UserRole;
  locatario_cnpj?: string;
  requireChangePassword?: boolean;
  isAdmin?: boolean;
}

export interface Locatario {
  id: number;
  nome: string;
  cnpj_cpf: string;
  endereco: string;
  telefone: string;
  contato_nome: string;
  contato_email: string;
  created_at: string;
}

export interface TipoEquipamento {
  id: number;
  nome: string;
}

export interface Equipamento {
  id: number;
  nome?: string;
  codigo: string;
  tipo_id: number;
  locatario_cnpj: string;
  ativo: boolean;
  data_cadastro: string;
  data_hora_bloqueio?: string | null;
  tipo_nome?: string;
  locatario_nome?: string;
  totalOs?: number;
}

export interface AppUser {
  id: number;
  username: string;
  role: UserRole;
  locatario_cnpj: string;
  nome: string;
  senha_padrao: boolean;
}

export interface Telemetria {
  id: number;
  mac: string;
  os: string;
  operador: string;
  equipamento: string;
  data_leitura: string;
  hora_leitura: string;
  lat: number;
  lon: number;
  seq: number;
  fw: string;
  build: string;
  build_num: number;
  locatario_cnpj?: string;
}
