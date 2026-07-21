import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { normalizeCpfCnpj } from './documentUtils';

export interface ClientData {
  id: string; // Firestore document id
  clientId: string;
  type: 'PF' | 'PJ';
  slug: string;
  active?: boolean;
  portalStatus?: string;
  googleDriveClientFolderId?: string;
  googleDriveClientFolderUrl?: string;
  pfData?: any;
  pfDadosPessoais?: any;
  pjData?: any;
  pjDadosEmpresa?: any;
  socioData?: any;
  socioAdministradorDadosPessoais?: any;
  acessoSistema?: any;
  dadosBancariosOpcional?: any;
}

// Fetch all clients as a base list to allow rich in-memory searches (filters)
export async function getAllClients(): Promise<ClientData[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'clients'));
    const clients: ClientData[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      clients.push({
        id: doc.id,
        clientId: data.clientId || doc.id,
        type: data.type || 'PF',
        slug: data.slug || '',
        active: data.active,
        pfData: data.pfData || data.pfDadosPessoais,
        pfDadosPessoais: data.pfDadosPessoais || data.pfData,
        pjData: data.pjData || data.pjDadosEmpresa,
        pjDadosEmpresa: data.pjDadosEmpresa || data.pjData,
        socioData: data.socioData || data.socioAdministradorDadosPessoais,
        socioAdministradorDadosPessoais: data.socioAdministradorDadosPessoais || data.socioData,
        acessoSistema: data.acessoSistema,
        dadosBancariosOpcional: data.dadosBancariosOpcional
      });
    });
    return clients;
  } catch (error) {
    console.error("Error fetching all clients for search", error);
    return [];
  }
}

// 1. Search by CPF
export async function searchByCpf(cpf: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const normalized = normalizeCpfCnpj(cpf);
  if (!normalized) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const cCpf = normalizeCpfCnpj(c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || '');
    return cCpf === normalized;
  });
}

// 2. Search by CNPJ
export async function searchByCnpj(cnpj: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const normalized = normalizeCpfCnpj(cnpj);
  if (!normalized) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const cCnpj = normalizeCpfCnpj(c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || '');
    return cCnpj === normalized;
  });
}

// 3. Search by Name
export async function searchByName(name: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const term = name.trim().toLowerCase();
  if (!term) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const cName = (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || '').toLowerCase();
    const cSocio = (c.socioAdministradorDadosPessoais?.socio_nomeCompleto || c.socioData?.socio_nomeCompleto || '').toLowerCase();
    return cName.includes(term) || cSocio.includes(term);
  });
}

// 4. Search by Razão Social
export async function searchByRazaoSocial(razaoSocial: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const term = razaoSocial.trim().toLowerCase();
  if (!term) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const cRazao = (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || '').toLowerCase();
    const cFantasia = (c.pjDadosEmpresa?.pj_nomeFantasia || c.pjData?.pj_nomeFantasia || '').toLowerCase();
    return cRazao.includes(term) || cFantasia.includes(term);
  });
}

// 5. Search by E-mail
export async function searchByEmail(email: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const term = email.trim().toLowerCase();
  if (!term) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const pfEmail = (c.pfDadosPessoais?.pf_email || c.pfData?.pf_email || '').toLowerCase();
    const pjEmail = (c.pjDadosEmpresa?.pj_emailEmpresa || c.pjData?.pj_emailEmpresa || '').toLowerCase();
    const socioEmail = (c.socioAdministradorDadosPessoais?.socio_email || c.socioData?.socio_email || '').toLowerCase();
    const loginEmail = (c.acessoSistema?.acesso_emailLogin || '').toLowerCase();
    return pfEmail.includes(term) || pjEmail.includes(term) || socioEmail.includes(term) || loginEmail.includes(term);
  });
}

// 6. Search by Telefone
export async function searchByTelefone(phone: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const pfTel = (c.pfDadosPessoais?.pf_telefone || c.pfData?.pf_telefone || '').replace(/\D/g, '');
    const pjTel = (c.pjDadosEmpresa?.pj_telefoneEmpresa || c.pjData?.pj_telefoneEmpresa || '').replace(/\D/g, '');
    const socioTel = (c.socioAdministradorDadosPessoais?.socio_telefone || c.socioData?.socio_telefone || '').replace(/\D/g, '');
    return pfTel.includes(cleanPhone) || pjTel.includes(cleanPhone) || socioTel.includes(cleanPhone);
  });
}

// 7. Search by WhatsApp
export async function searchByWhatsapp(whatsapp: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const cleanPhone = whatsapp.replace(/\D/g, '');
  if (!cleanPhone) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => {
    const pfWhats = (c.pfDadosPessoais?.pf_whatsapp || c.pfData?.pf_whatsapp || '').replace(/\D/g, '');
    const pjWhats = (c.pjDadosEmpresa?.pj_whatsappEmpresa || c.pjData?.pj_whatsappEmpresa || '').replace(/\D/g, '');
    const socioWhats = (c.socioAdministradorDadosPessoais?.socio_whatsapp || c.socioData?.socio_whatsapp || '').replace(/\D/g, '');
    return pfWhats.includes(cleanPhone) || pjWhats.includes(cleanPhone) || socioWhats.includes(cleanPhone);
  });
}

// 8. Search by Slug
export async function searchBySlug(slug: string, allClientsList?: ClientData[]): Promise<ClientData[]> {
  const term = slug.trim().toLowerCase();
  if (!term) return [];
  const list = allClientsList || await getAllClients();
  return list.filter(c => c.slug.toLowerCase().includes(term));
}

// Unified finder helper to match against any potential field typed by the user
export async function unifiedSearch(queryStr: string): Promise<ClientData[]> {
  const term = queryStr.trim().toLowerCase();
  if (!term) return [];
  
  const list = await getAllClients();
  const cleanQuery = term.replace(/\D/g, '');
  
  return list.filter(c => {
    const cpf = normalizeCpfCnpj(c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || '');
    const cnpj = normalizeCpfCnpj(c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || '');
    
    if (cleanQuery && (cpf === cleanQuery || cnpj === cleanQuery)) {
      return true;
    }
    
    const name = (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || '').toLowerCase();
    const socio = (c.socioAdministradorDadosPessoais?.socio_nomeCompleto || c.socioData?.socio_nomeCompleto || '').toLowerCase();
    const rSocial = (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || '').toLowerCase();
    const fantasia = (c.pjDadosEmpresa?.pj_nomeFantasia || c.pjData?.pj_nomeFantasia || '').toLowerCase();
    const slugVal = c.slug.toLowerCase();
    
    const pfEmail = (c.pfDadosPessoais?.pf_email || c.pfData?.pf_email || '').toLowerCase();
    const pjEmail = (c.pjDadosEmpresa?.pj_emailEmpresa || c.pjData?.pj_emailEmpresa || '').toLowerCase();
    const socioEmail = (c.socioAdministradorDadosPessoais?.socio_email || c.socioData?.socio_email || '').toLowerCase();
    
    const phonePf = (c.pfDadosPessoais?.pf_telefone || c.pfData?.pf_telefone || '').replace(/\D/g, '');
    const phonePj = (c.pjDadosEmpresa?.pj_telefoneEmpresa || c.pjData?.pj_telefoneEmpresa || '').replace(/\D/g, '');
    
    return name.includes(term) || 
           socio.includes(term) || 
           rSocial.includes(term) || 
           fantasia.includes(term) || 
           slugVal.includes(term) ||
           pfEmail.includes(term) ||
           pjEmail.includes(term) ||
           socioEmail.includes(term) ||
           (cleanQuery && phonePf.includes(cleanQuery)) ||
           (cleanQuery && phonePj.includes(cleanQuery));
  });
}
