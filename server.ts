import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcrypt';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.use(express.json());
  
  // Rewrite /tmo/api/... to /api/...
  app.use((req, res, next) => {
    if (req.url.startsWith('/tmo/api/')) {
      req.url = req.url.replace('/tmo/api/', '/api/');
    }
    next();
  });

  app.use(cors());

  // Database Connection
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
  });

  // Helper function to execute queries 
  async function queryAsUser(roleName: string, queryStr: string, params: any[] = []) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const [rows] = await connection.query(queryStr, params);
      
      await connection.commit();
      return rows as any[];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Auto-setup DB Tables
  async function setupDatabase() {
    try {
      const connection = await pool.getConnection();
      await connection.query(`
        CREATE TABLE IF NOT EXISTS md_dispositivos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          mac VARCHAR(50),
          os VARCHAR(100),
          operador VARCHAR(100),
          equipamento VARCHAR(100),
          data_leitura DATE DEFAULT (CURRENT_DATE),
          hora_leitura TIME DEFAULT (CURRENT_TIME),
          lat DECIMAL(10, 8),
          lon DECIMAL(11, 8),
          seq INT DEFAULT 0,
          fw VARCHAR(50),
          build VARCHAR(50),
          build_num INT DEFAULT 0,
          proprietario VARCHAR(100)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS md_app_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'LOCATARIO',
          locatario_cnpj VARCHAR(50),
          nome VARCHAR(255),
          ativo BOOLEAN DEFAULT TRUE,
          senha_padrao BOOLEAN DEFAULT TRUE
        )
      `);
      await connection.query(`
          CREATE TABLE IF NOT EXISTS md_locatarios (
              id INT AUTO_INCREMENT PRIMARY KEY,
              nome VARCHAR(255) NOT NULL,
              cnpj_cpf VARCHAR(50) UNIQUE NOT NULL,
              endereco TEXT,
              telefone VARCHAR(50),
              contato_nome VARCHAR(255),
              contato_email VARCHAR(255),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
      `);
      await connection.query(`
          CREATE TABLE IF NOT EXISTS md_tipo_equipamentos (
              id INT AUTO_INCREMENT PRIMARY KEY,
              nome VARCHAR(100) UNIQUE NOT NULL
          )
      `);
      await connection.query("INSERT IGNORE INTO md_tipo_equipamentos (nome) VALUES ('BioCap'), ('BioHigien');");
      await connection.query(`
          CREATE TABLE IF NOT EXISTS md_equipamentos (
              id INT AUTO_INCREMENT PRIMARY KEY,
              nome VARCHAR(255),
              codigo VARCHAR(100) UNIQUE NOT NULL,
              tipo_id INT,
              locatario_cnpj VARCHAR(50),
              ativo BOOLEAN DEFAULT TRUE,
              data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tipo_id) REFERENCES md_tipo_equipamentos(id),
              FOREIGN KEY (locatario_cnpj) REFERENCES md_locatarios(cnpj_cpf) ON UPDATE CASCADE ON DELETE SET NULL
          )
      `);
      await connection.query(`
          CREATE TABLE IF NOT EXISTS md_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(100),
              acao TEXT,
              data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
              detalhes TEXT
          )
      `);
      await connection.query(`
          CREATE TABLE IF NOT EXISTS md_equipamentos_bloqueados (
              codigo VARCHAR(100) PRIMARY KEY
          )
      `);
      try {
        await connection.query("ALTER TABLE md_equipamentos ADD COLUMN nome VARCHAR(255);");
      } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME') {
           console.error('Migration error add nome', e);
        }
      }
      try {
        await connection.query("ALTER TABLE md_app_users ADD COLUMN ativo BOOLEAN DEFAULT TRUE;");
      } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME') {
           console.error('Migration error add ativo us', e);
        }
      }

      // Automatically backfill any orphaned equipments from md_dispositivos to md_equipamentos
      await connection.query(`
        INSERT IGNORE INTO md_equipamentos (codigo, nome, ativo)
        SELECT DISTINCT equipamento, CONCAT('Auto_ ', equipamento), 1
        FROM md_dispositivos
        WHERE equipamento IS NOT NULL AND equipamento != ''
      `);      

      connection.release();
      console.log('Database tables verified/created successfully.');
    } catch (error) {
      console.error('Failed to setup database tables:', error);
      throw error;
    }
  }

  // Run the setup when we have a DATABASE_URL
  if (process.env.DATABASE_URL) {
    const runSetupWithRetry = async (retries = 10, delay = 5000) => {
      for (let i = 0; i < retries; i++) {
        try {
          await setupDatabase();
          return;
        } catch (error) {
          console.log(`Retrying database setup in ${delay / 1000}s... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      console.error('Failed to setup database tables after maximum retries.');
    };
    runSetupWithRetry();
  }

  class ApiError extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode: number = 500, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }

  const asyncHandler = (fn: express.RequestHandler) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

  const parseDateString = (dataStr: string | undefined): string | undefined => {
    if (!dataStr) return dataStr;
    if (typeof dataStr === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
      const [dd, mm, yyyy] = dataStr.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    return dataStr;
  };

  const ensureEquipamentoExists = async (codigo: string) => {
    if (!codigo) return;
    const connection = await pool.getConnection();
    try {
      await connection.query('INSERT IGNORE INTO md_equipamentos (codigo, nome, ativo) VALUES (?, ?, ?)', [codigo, `Auto_ ${codigo}`, true]);
    } catch (err) {
      console.error('Error ensuring equipamento exists:', err);
    } finally {
      connection.release();
    }
  };

  // --- API Routes ---

  // Real Database Authentication (Estratégia Backend / Cenário B)
  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();
    
    if (!username) throw new ApiError('Email necessário', 400);
    if (!password) throw new ApiError('Senha necessária', 400);

    const masterSecret = process.env.ADMIN_SECRET || 'admin123';
    const masterEmail = process.env.ADMIN_EMAIL || 'master@admin.com';
    
    if (username === masterEmail) {
      if (password === masterSecret) {
        return res.json({
          success: true,
          user: masterEmail,
          role: 'LOCADOR_MASTER',
          isAdmin: true,
          adminSecret: masterSecret,
          message: "Autenticado como Master com sucesso"
        });
      } else {
        throw new ApiError('Senha do master incorreta.', 401, 'AUTH_FAILED');
      }
    }

    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query('SELECT * FROM md_app_users WHERE username = ? OR locatario_cnpj = ? ORDER BY role = \'LOCATARIO_MASTER\' DESC LIMIT 1', [username, username]);
      
      if (rows.length === 0) {
        throw new ApiError(`Credenciais incorretas: A senha está errada ou o email/CNPJ "${username}" não existe.`, 401, 'AUTH_FAILED');
      }

      let isMatch = false;
      const storedPassword = rows[0].password;
      if (storedPassword && (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$'))) {
        isMatch = await bcrypt.compare(password, storedPassword);
      } else {
        // Fallback backward-compatibility for plaintext
        isMatch = password === storedPassword;
      }

      if (!isMatch) {
        throw new ApiError(`Credenciais incorretas: A senha está errada ou o email "${username}" não existe.`, 401, 'AUTH_FAILED');
      }
      
      const dbUser = rows[0];
      if (dbUser.ativo === 0) {
        throw new ApiError('Seu usuário está bloqueado. Contate o administrador.', 403, 'AUTH_LOCKED');
      }
      
      res.json({ 
        success: true, 
        user: dbUser.username,
        nome: dbUser.nome,
        role: dbUser.role,
        locatario_cnpj: dbUser.locatario_cnpj,
        requireChangePassword: Boolean(dbUser.senha_padrao),
        isAdmin: dbUser.role === 'LOCADOR_MASTER',
        message: "Autenticado com sucesso"
      }); 
    } finally {
      connection.release();
    }
  }));

  app.post('/api/auth/change-password', asyncHandler(async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) throw new ApiError('Faltam parâmetros', 400);

    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query('SELECT * FROM md_app_users WHERE username = ?', [username]);
      if (rows.length === 0) throw new ApiError('Usuário não encontrado', 404);
      
      const storedPassword = rows[0].password;
      let isMatch = false;
      if (storedPassword && (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$'))) {
        isMatch = await bcrypt.compare(currentPassword, storedPassword);
      } else {
        isMatch = currentPassword === storedPassword;
      }

      if (!isMatch) throw new ApiError('Senha atual incorreta', 401);

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await connection.query('UPDATE md_app_users SET password = ?, senha_padrao = FALSE WHERE username = ?', [hashedNewPassword, username]);
      
      await connection.query('INSERT INTO md_logs (username, acao, detalhes) VALUES (?, ?, ?)', [username, 'MUDANCA_SENHA', 'Usuário alterou a senha padrão']);
      res.json({ success: true, message: 'Senha atualizada com sucesso.' });
    } finally {
      connection.release();
    }
  }));

  // Healthcheck / Connection check
  app.get('/api/health', asyncHandler(async (req, res) => {
    if (!process.env.DATABASE_URL) {
      throw new ApiError('DATABASE_URL não configurada no .env', 500);
    }
    const connection = await pool.getConnection();
    const [rows]: any = await connection.query('SELECT NOW() as time');
    connection.release();
    res.json({ status: 'ok', db_time: rows[0].time });
  }));

  // Setup Database
  app.post('/api/admin/setup', asyncHandler(async (req, res) => {
    const { adminSecret } = req.body;
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    if (!process.env.DATABASE_URL) {
      throw new ApiError('DATABASE_URL não configurada no .env', 500);
    }
    
    await setupDatabase();
    res.json({ success: true, message: 'Processo de setup do banco de dados concluído.' });
  }));

  // --- Equipment-Centric API Endpoints ---
  // Endpoints projetados para serem consumidos diretamente pelo equipamento.

  // 1. Inserir ou Atualizar Telemetria do Equipamento
  app.post(['/api/equipamento/:equipamento', '/api/equipamento'], asyncHandler(async (req, res) => {
    const { user } = req.query; 
    let { mac, os, operador, lat, lon, fw, build, build_num, seq, data, hora, equipamento: bodyEquipamento } = req.body;
    const equipamento = req.params.equipamento || bodyEquipamento;

    if (!equipamento) {
      throw new ApiError('O campo "equipamento" é obrigatório na URL ou no corpo (JSON).', 400);
    }
    
    data = parseDateString(data);
    await ensureEquipamentoExists(equipamento);

    let lastEntry = null;
    if (user) {
       const findQuery = `SELECT * FROM md_dispositivos WHERE equipamento = ? ORDER BY seq DESC, id DESC LIMIT 1`;
       const lastEntryRows: any = await queryAsUser((user as string), findQuery, [equipamento]);
       lastEntry = lastEntryRows.length > 0 ? lastEntryRows[0] : null;
    } else {
       const connection = await pool.getConnection();
       const [resDb]: any = await connection.query('SELECT * FROM md_dispositivos WHERE equipamento = ? ORDER BY seq DESC, id DESC LIMIT 1', [equipamento]);
       lastEntry = resDb.length > 0 ? resDb[0] : null;
       connection.release();
    }

    const newMac = mac !== undefined ? mac : (lastEntry?.mac || '');
    const newOs = os !== undefined ? os : (lastEntry?.os || '');
    const newOperador = operador !== undefined ? operador : (lastEntry?.operador || '');
    const newLat = lat !== undefined ? lat : (lastEntry?.lat || 0);
    const newLon = lon !== undefined ? lon : (lastEntry?.lon || 0);
    const newFw = fw !== undefined ? fw : (lastEntry?.fw || '');
    const newBuild = build !== undefined ? build : (lastEntry?.build || '');
    const newBuildNum = build_num !== undefined ? build_num : (lastEntry?.build_num || '');
    const newSeq = seq !== undefined ? seq : (lastEntry?.seq || 0);

    let dataLeituraQuery = data !== undefined ? '?' : 'CURRENT_DATE';
    let horaLeituraQuery = hora !== undefined ? '?' : 'CURRENT_TIME';

    const query = `
      INSERT INTO md_dispositivos (
        equipamento, mac, os, operador, lat, lon, fw, build, build_num, proprietario, seq, data_leitura, hora_leitura
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${dataLeituraQuery}, ${horaLeituraQuery}
      )
    `;
    const owner = user || lastEntry?.proprietario || null; 
    
    let params = [equipamento, newMac, newOs, newOperador, newLat, newLon, newFw, newBuild, newBuildNum, owner, newSeq];
    if (data !== undefined) params.push(data);
    if (hora !== undefined) params.push(hora);
    
    const connection = await pool.getConnection();
    try {
      if (newOs && newOs.trim() !== '') {
         const [existingOs]: any = await connection.query('SELECT * FROM md_dispositivos WHERE equipamento = ? AND os = ? ORDER BY id DESC LIMIT 1', [equipamento, newOs]);
         if (existingOs.length > 0) {
             return res.status(200).json({ success: true, message: 'OS já registrada, ignorando duplicada.', data: existingOs[0] });
         }
      }

      const [header]: any = await connection.query(query, params);
      const [newRows]: any = await connection.query('SELECT * FROM md_dispositivos WHERE id = ?', [header.insertId]);
      res.status(201).json({ success: true, message: 'Telemetria registrada com sucesso', data: newRows[0] });
    } finally {
      connection.release();
    }
  }));

  // 2. Buscar Histórico / Logs do Equipamento
  app.get('/api/equipamento/:equipamento/historico', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    const { equipamento } = req.params;
    if (!user) throw new ApiError('Usuário não especificado na requisição (?user=...).', 401);

    const query = `SELECT * FROM md_dispositivos WHERE equipamento = ? AND proprietario = ? ORDER BY data_leitura DESC, hora_leitura DESC`;
    const rows: any = await queryAsUser(user as string, query, [equipamento, user]);
    res.json({ success: true, count: rows.length, data: rows });
  }));

  // 3. Atualizar Sistema Operacional (OS) diretamente
  app.patch('/api/equipamento/:equipamento/os', asyncHandler(async (req, res) => {
    const { equipamento } = req.params;
    const { os } = req.body;

    if (os === undefined) throw new ApiError('Campo "os" é obrigatório.', 400);

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query(`UPDATE md_dispositivos SET os = ? WHERE equipamento = ?`, [os, equipamento]);
      
      if (result.affectedRows === 0) {
        throw new ApiError('Nenhum dispositivo atualizado. O equipamento não existe.', 404);
      }
      const [updated]: any = await connection.query(`SELECT * FROM md_dispositivos WHERE equipamento = ? ORDER BY id DESC LIMIT 1`, [equipamento]);
      res.json({ success: true, message: 'OS atualizado com sucesso.', updated: updated[0] });
    } finally {
      connection.release();
    }
  }));

  // 4. Deletar Equipamento Completamente
  app.delete('/api/equipamento/:equipamento', asyncHandler(async (req, res) => {
    const { user } = req.query;
    const { equipamento } = req.params;
    if (!user) throw new ApiError('Usuário não especificado.', 401);

    const query = `DELETE FROM md_dispositivos WHERE equipamento = ? AND proprietario = ?`;
    const result: any = await queryAsUser(user as string, query, [equipamento, user]);
    
    res.json({ success: true, message: `Equipamento ${equipamento} deletado.`, deleted_logs: result.affectedRows });
  }));


  // --- RESTful Frontend Routes (Legacy) ---
  
  // Get Devices (Simulation of RLS for the logged user)
  app.get('/api/dispositivos', asyncHandler(async (req, res) => {
    const { user } = req.query; // Pega o usuário simulado
    if (!user) throw new ApiError('Usuário não especificado na requisição (simulação de token).', 401);

    // Garantindo que a pessoa veja apenas os próprios dados mesmo sem RLS
    const query = `
      SELECT id, equipamento, mac, os, operador, data_leitura, hora_leitura, lat, lon, seq, fw, build, build_num, proprietario 
      FROM md_dispositivos
      WHERE proprietario = ?
      ORDER BY data_leitura DESC, hora_leitura DESC
    `;

    const rows = await queryAsUser(user as string, query, [user]);
    res.json(rows);
  }));

  // Create Device (Simulation of RLS for the logged user)
  app.post('/api/dispositivos', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    if (!user) throw new ApiError('Usuário não especificado na requisição (simulação de token).', 401);

    const { equipamento, mac, os, operador, lat, lon, fw, build, build_num } = req.body;
    await ensureEquipamentoExists(equipamento);
    
    // Aqui enviamos pro banco apenas o que o painel visual nos mandou.
    // O banco (ou via defaults, ou outras integrações) cuida do resto.
    if (os && os.trim() !== '') {
       const findOsQuery = `SELECT * FROM md_dispositivos WHERE equipamento = ? AND os = ? ORDER BY id DESC LIMIT 1`;
       const existingOsRows: any = await queryAsUser(user as string, findOsQuery, [equipamento, os]);
       if (existingOsRows.length > 0) {
           return res.json(existingOsRows[0]);
       }
    }

    const query = `
      INSERT INTO md_dispositivos (
        equipamento, mac, os, operador, lat, lon, proprietario, fw, build, build_num
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const params = [equipamento, mac, os, operador, lat, lon, user, fw, build, build_num];
    
    const result: any = await queryAsUser(user as string, query, params);
    const updated = await queryAsUser(user as string, `SELECT * FROM md_dispositivos WHERE id = ?`, [result.insertId]);
    res.status(201).json(updated[0]);
  }));

  // Update Device OS
  app.patch('/api/dispositivos/:equipamento/os', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    if (!user) throw new ApiError('Usuário não especificado na requisição.', 401);

    const { equipamento } = req.params;
    const { os } = req.body;

    if (os === undefined) throw new ApiError('Campo "os" é obrigatório.', 400);

    // Atualiza o OS para o equipamento especificado, forçando o dono do equipamento
    const query = `UPDATE md_dispositivos SET os = ? WHERE equipamento = ? AND proprietario = ?`;
    const result: any = await queryAsUser(user as string, query, [os, equipamento, user]);
    
    if (result.affectedRows === 0) {
      throw new ApiError('Nenhum dispositivo atualizado. O equipamento não existe ou você não tem permissão.', 403);
    }
    
    const updated = await queryAsUser(user as string, `SELECT * FROM md_dispositivos WHERE equipamento = ? AND proprietario = ? ORDER BY id DESC LIMIT 1`, [equipamento, user]);
    res.json({ success: true, updated: updated });
  }));

  app.post('/api/dispositivos/vincular', asyncHandler(async (req, res) => {
    const { user } = req.query;
    if (!user) throw new ApiError('Usuário não especificado.', 401);

    const { equipamento } = req.body;
    if (!equipamento) throw new ApiError('Equipamento não especificado.', 400);

    // Atualiza o proprietario para o usuário atual. 
    // Utiliza o usuário mestre (sem RLS) para conseguir acessar os registros que não são dele ainda
    const connection = await pool.getConnection();
    try {
      const query = `UPDATE md_dispositivos SET proprietario = ? WHERE equipamento = ?`;
      const [result]: any = await connection.query(query, [user, equipamento]);

      if (result.affectedRows === 0) {
         throw new ApiError('Nenhum registro encontrado para este equipamento na base de dados.', 404);
      }

      res.json({ message: `${result.affectedRows} registros vinculados com sucesso.`, count: result.affectedRows });
    } finally {
      connection.release();
    }
  }));

  // Endpoint para atualizar um dispositivo recebendo o corpo completo (usando 'equipamento' como identificador)
  app.post('/api/dispositivos/atualizar', asyncHandler(async (req, res) => {
    const { user } = req.query; 

    // Recebe todos os dados do corpo da requisição
    let { equipamento, mac, os, operador, lat, lon, fw, build, build_num, seq, data, hora } = req.body;

    data = parseDateString(data);

    if (!equipamento) throw new ApiError('O campo "equipamento" é obrigatório como identificador.', 400);

    await ensureEquipamentoExists(equipamento);

    // Busca o registro mais recente do mesmo equipamento para herdar campos não enviados
    const findQuery = `SELECT * FROM md_dispositivos WHERE equipamento = ? ORDER BY seq DESC, id DESC LIMIT 1`;
    const lastEntryRows: any = await queryAsUser((user as string) || '', findQuery, [equipamento]);
    const lastEntry = lastEntryRows.length > 0 ? lastEntryRows[0] : null;

    const newMac = mac !== undefined ? mac : (lastEntry?.mac || '');
    const newOs = os !== undefined ? os : (lastEntry?.os || '');
    const newOperador = operador !== undefined ? operador : (lastEntry?.operador || '');
    const newLat = lat !== undefined ? lat : (lastEntry?.lat || 0);
    const newLon = lon !== undefined ? lon : (lastEntry?.lon || 0);
    const newFw = fw !== undefined ? fw : (lastEntry?.fw || '');
    const newBuild = build !== undefined ? build : (lastEntry?.build || '');
    const newBuildNum = build_num !== undefined ? build_num : (lastEntry?.build_num || 0);
    const newSeq = seq !== undefined ? seq : (lastEntry?.seq || 0);
    
    // Se não vier usuário na URL, tenta herdar o proprietário anterior
    const owner = user || lastEntry?.proprietario || 'default_user';

    let dataLeituraQuery = data !== undefined ? '?' : 'CURRENT_DATE';
    let horaLeituraQuery = hora !== undefined ? '?' : 'CURRENT_TIME';

    const insertQuery = `
      INSERT INTO md_dispositivos (
        equipamento, mac, os, operador, lat, lon, fw, build, build_num, proprietario,
        seq, data_leitura, hora_leitura
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ${dataLeituraQuery}, ${horaLeituraQuery}
      )
    `;

    const paramsInsert = [
      equipamento, newMac, newOs, newOperador, newLat, newLon, newFw, newBuild, newBuildNum, owner, newSeq
    ];
    if (data !== undefined) paramsInsert.push(data);
    if (hora !== undefined) paramsInsert.push(hora);

    if (newOs && newOs.trim() !== '') {
       const findOsQuery = `SELECT * FROM md_dispositivos WHERE equipamento = ? AND os = ? ORDER BY id DESC LIMIT 1`;
       const existingOsRows: any = await queryAsUser((user as string) || '', findOsQuery, [equipamento, newOs]);
       if (existingOsRows.length > 0) {
           return res.json({ success: true, updated: existingOsRows[0], message: 'OS duplicada ignorada.' });
       }
    }

    const result: any = await queryAsUser((user as string) || '', insertQuery, paramsInsert);
    const updated = await queryAsUser((user as string) || '', `SELECT * FROM md_dispositivos WHERE id = ?`, [result.insertId]);
    res.json({ success: true, updated: updated[0] });
  }));

  app.delete('/api/dispositivos/log/:id', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    if (!user) throw new ApiError('Usuário não especificado na requisição.', 401);

    const { id } = req.params;

    const query = `DELETE FROM md_dispositivos WHERE id = ? AND proprietario = ?`;
    const result: any = await queryAsUser(user as string, query, [id, user]);
    
    if (result.affectedRows === 0) {
      throw new ApiError('Nenhum log deletado. O item não existe ou você não tem permissão.', 403);
    }
    
    res.json({ success: true, message: `Log deletado com sucesso.` });
  }));

  app.put('/api/dispositivos/log/:id', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    if (!user) throw new ApiError('Usuário não especificado na requisição.', 401);

    const { id } = req.params;
    const { mac, os, operador, lat, lon, fw, build, build_num, equipamento } = req.body;

    const query = `
      UPDATE md_dispositivos 
      SET mac = ?, os = ?, operador = ?, lat = ?, lon = ?, fw = ?, build = ?, build_num = ?, equipamento = ?
      WHERE id = ? AND proprietario = ?
    `;
    const params = [mac, os, operador, lat, lon, fw, build, build_num, equipamento, id, user];
    const result: any = await queryAsUser(user as string, query, params);
    
    if (result.affectedRows === 0) {
      throw new ApiError('Nenhum log atualizado. O item não existe ou você não tem permissão.', 403);
    }
    
    res.json({ success: true, message: `Log atualizado com sucesso.` });
  }));

  // Delete Device
  app.delete('/api/dispositivos/:equipamento', asyncHandler(async (req, res) => {
    const { user } = req.query; 
    if (!user) throw new ApiError('Usuário não especificado na requisição.', 401);

    const { equipamento } = req.params;

    const query = `DELETE FROM md_dispositivos WHERE equipamento = ? AND proprietario = ?`;
    const result: any = await queryAsUser(user as string, query, [equipamento, user]);
    
    if (result.affectedRows === 0) {
      throw new ApiError('Nenhum dispositivo deletado. O item não existe ou você não tem permissão.', 403);
    }
    
    res.json({ success: true, deleted: result.affectedRows });
  }));

  // Register User (Admin)
  app.post('/api/admin/users', asyncHandler(async (req, res) => {
    const { newRole, newPassword, adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    if (!newRole || !newRole.includes('@')) {
       throw new ApiError('Email de usuário inválido', 400);
    }

    if (!newPassword || newPassword.length < 6) {
       throw new ApiError('Senha do novo usuário deve ter pelo menos 6 caracteres', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const [check]: any = await connection.query('SELECT username FROM md_app_users WHERE username = ?', [newRole]);
      if (check.length > 0) {
        await connection.rollback();
        throw new ApiError('Este usuário já existe no banco de dados.', 400);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await connection.query('INSERT INTO md_app_users (username, password) VALUES (?, ?)', [newRole, hashedPassword]);

      await connection.commit();
      
      res.status(201).json({ success: true, message: `Usuário ${newRole} criado com sucesso!` });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }));

  // Delete User (Admin)
  app.delete('/api/admin/users/:username', asyncHandler(async (req, res) => {
    const { username } = req.params;
    const { adminSecret } = req.body;
    
    console.log("Recebido pedido para apagar:", username);
    
    // Simple admin secret check 
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    if (!username) {
       throw new ApiError('Identificação inválida', 400);
    }

    try {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        await connection.query('DELETE FROM md_dispositivos WHERE proprietario = ?', [username]);
        await connection.query('DELETE FROM md_app_users WHERE username = ?', [username]);
        
        await connection.commit();
        res.json({ success: true, message: `Usuário '${username}' e todos os seus dispositivos foram deletados.` });
      } catch (err: any) {
        await connection.rollback();
        console.error("Erro ao deletar usuário (transação):", err);
        throw err;
      } finally {
        connection.release();
      }
    } catch (err: any) {
      throw new ApiError(`Erro ao deletar usuário: ${err.message}`, 500);
    }
  }));

  // List Users (Admin)
  app.post('/api/admin/list-users', asyncHandler(async (req, res) => {
    const { adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query(`
        SELECT username AS rolname 
        FROM md_app_users 
        ORDER BY username
      `);
      res.json({ success: true, users: result.map((row: any) => row.rolname) });
    } finally {
      connection.release();
    }
  }));

  // List Devices (Admin)
  app.post('/api/admin/dispositivos', asyncHandler(async (req, res) => {
    const { adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query(`
        SELECT d1.*
        FROM md_dispositivos d1
        INNER JOIN (
            SELECT proprietario, equipamento, MAX(data_leitura) as max_data, MAX(hora_leitura) as max_hora, MAX(id) as max_id
            FROM md_dispositivos
            GROUP BY proprietario, equipamento
        ) d2 ON d1.id = d2.max_id
        ORDER BY d1.proprietario ASC, d1.equipamento ASC, d1.data_leitura DESC, d1.hora_leitura DESC
      `);
      res.json({ success: true, data: result });
    } finally {
      connection.release();
    }
  }));

  app.post('/api/admin/dispositivos/:equipamento/history', asyncHandler(async (req, res) => {
    const { equipamento } = req.params;
    const { adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query(`
        SELECT * FROM md_dispositivos WHERE equipamento = ? ORDER BY id DESC
      `, [equipamento]);
      res.json({ success: true, data: result });
    } finally {
      connection.release();
    }
  }));

  app.put('/api/admin/dispositivos/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminSecret, mac, os, operador, equipamento, proprietario, fw, build, build_num } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query(`
        UPDATE md_dispositivos 
        SET mac = ?, os = ?, operador = ?, equipamento = ?, proprietario = ?, fw = ?, build = ?, build_num = ?
        WHERE id = ?
      `, [mac, os, operador, equipamento, proprietario, fw, build, build_num, id]);

      if (result.affectedRows === 0) {
        throw new ApiError('Nenhum dispositivo atualizado. O item não existe.', 404);
      }

      res.json({ success: true, message: `Equipamento atualizado com sucesso.` });
    } finally {
      connection.release();
    }
  }));

  // Create Equipment (Admin)
  app.post('/api/admin/dispositivos/create', asyncHandler(async (req, res) => {
    let { equipamento, mac, os, operador, proprietario, fw, build, build_num, adminSecret, data, hora, lat, lon, seq } = req.body;
    
    data = parseDateString(data);

    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    if (!equipamento || !proprietario) {
       throw new ApiError('Nome do equipamento e proprietário são obrigatórios.', 400);
    }

    await ensureEquipamentoExists(equipamento);

    const connection = await pool.getConnection();
    try {
      let dataLeituraQuery = data !== undefined && data !== '' ? '?' : 'CURRENT_DATE';
      let horaLeituraQuery = hora !== undefined && hora !== '' ? '?' : 'CURRENT_TIME';
      
      const params = [mac || '', os || '', operador || '', equipamento, proprietario, fw || '', build || '', build_num || 0, lat || null, lon || null, seq || 0];
      if (data !== undefined && data !== '') params.push(data);
      if (hora !== undefined && hora !== '') params.push(hora);

      if (os && os.trim() !== '') {
         const [existingOs]: any = await connection.query('SELECT * FROM md_dispositivos WHERE equipamento = ? AND os = ? ORDER BY id DESC LIMIT 1', [equipamento, os]);
         if (existingOs.length > 0) {
             return res.json({ success: true, message: `O.S. ${os} já registrada no equipamento ${equipamento}, ignorando duplicada.` });
         }
      }

      await connection.query(`
        INSERT INTO md_dispositivos 
        (mac, os, operador, equipamento, proprietario, fw, build, build_num, lat, lon, seq, data_leitura, hora_leitura) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${dataLeituraQuery}, ${horaLeituraQuery})
      `, params);

      res.status(201).json({ success: true, message: `Equipamento ${equipamento} criado com sucesso.` });
    } finally {
      connection.release();
    }
  }));

  app.delete('/api/admin/dispositivos/log/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query('DELETE FROM md_dispositivos WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        throw new ApiError('Nenhum log deletado. O item não existe.', 404);
      }
      res.json({ success: true, message: `Ordem de Serviço (Log ID ${id}) deletada com sucesso.` });
    } finally {
      connection.release();
    }
  }));

  // Delete Equipment (Admin)
  app.delete('/api/admin/dispositivos/:equipamento', asyncHandler(async (req, res) => {
    const { equipamento } = req.params;
    const { adminSecret } = req.body;
    
    const serverSecret = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== serverSecret) {
       throw new ApiError('Senha de administrador inválida', 403);
    }

    const connection = await pool.getConnection();
    try {
      const [result]: any = await connection.query('DELETE FROM md_dispositivos WHERE equipamento = ?', [equipamento]);
      res.json({ success: true, message: `Equipamento ${equipamento} e todo o seu histórico foram deletados.` });
    } finally {
      connection.release();
    }
  }));

  
  // --- NOVAS ROTAS (LOCADOR / LOCATÁRIO) ---
  
  const getUserFromReq = async (req: express.Request) => {
    let email = req.query.user as string || req.headers['x-user-email'] as string;
    if (!email) return null;
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query('SELECT * FROM md_app_users WHERE username = ?', [email]);
      if (rows.length > 0) return rows[0];
      if (email === (process.env.ADMIN_EMAIL || 'master@admin.com')) return { username: email, role: 'LOCADOR_MASTER', isAdmin: true };
      return null;
    } finally { connection.release(); }
  };

  const checkRole = (allowedRoles: string[]) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
       const user = await getUserFromReq(req);
       if (!user) throw new ApiError('Não autorizado. Informe ?user= ou Header X-User-Email', 401);
       if (!allowedRoles.includes(user.role)) throw new ApiError('Acesso negado para o seu perfil.', 403);
       (req as any).authUser = user;
       next();
    } catch (e) {
       next(e);
    }
  };
  
  const logAction = async (username: string, acao: string, detalhes: string) => {
     const connection = await pool.getConnection();
     try {
       await connection.query('INSERT INTO md_logs (username, acao, detalhes) VALUES (?, ?, ?)', [username, acao, detalhes]);
     } catch (e) { console.error("Log error", e); }
     finally { connection.release(); }
  };

  // 1. Locatários (CRUD) - Apenas Locadores
  app.get('/api/locatarios', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER', 'LOCATARIO']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM md_locatarios ORDER BY nome ASC';
      let params: any[] = [];
      if (user.role.startsWith('LOCATARIO')) {
         query = 'SELECT * FROM md_locatarios WHERE cnpj_cpf = ? ORDER BY nome ASC';
         params = [user.locatario_cnpj];
      }
      const [rows] = await connection.query(query, params);
      res.json(rows);
    } finally { connection.release(); }
  }));

  app.post('/api/locatarios', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { nome, cnpj_cpf, endereco, telefone, contato_nome, contato_email, senha_master } = req.body;
    if (!nome || !cnpj_cpf) throw new ApiError('Nome e CNPJ são obrigatórios', 400);
    const connection = await pool.getConnection();
    try {
      if (contato_email && senha_master) {
         const [existing]: any = await connection.query('SELECT id FROM md_app_users WHERE username = ?', [contato_email]);
         if (existing.length > 0) {
           throw new ApiError('Este email já está em uso.', 400);
         }
      }

      await connection.beginTransaction();
      
      await connection.query('INSERT INTO md_locatarios (nome, cnpj_cpf, endereco, telefone, contato_nome, contato_email) VALUES (?, ?, ?, ?, ?, ?)', 
        [nome, cnpj_cpf, endereco, telefone, contato_nome, contato_email]);
        
      if (contato_email && senha_master) {
         const hashed = await bcrypt.hash(senha_master, 10);
         await connection.query('INSERT IGNORE INTO md_app_users (username, password, role, locatario_cnpj, nome) VALUES (?, ?, ?, ?, ?)', 
           [contato_email, hashed, 'LOCATARIO_MASTER', cnpj_cpf, contato_nome]);
      }
      
      await logAction((req as any).authUser.username, 'CREATE_LOCATARIO', 'Criou locatário ' + cnpj_cpf);
      
      await connection.commit();
      res.json({ success: true });
    } catch(err: any) {
      await connection.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError('Já existe um locatário com esse CNPJ/CPF.', 400);
      }
      throw err;
    } finally { connection.release(); }
  }));

  app.put('/api/locatarios/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nome, cnpj_cpf, endereco, telefone, contato_nome, contato_email, senha_master } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.query('UPDATE md_locatarios SET nome=?, cnpj_cpf=?, endereco=?, telefone=?, contato_nome=?, contato_email=? WHERE id=?', 
        [nome, cnpj_cpf, endereco, telefone, contato_nome, contato_email, id]);
        
      if (contato_email && senha_master) {
         const hashed = await bcrypt.hash(senha_master, 10);
         await connection.query('INSERT INTO md_app_users (username, password, role, locatario_cnpj, nome) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=?, role=?, locatario_cnpj=?, nome=?', 
           [contato_email, hashed, 'LOCATARIO_MASTER', cnpj_cpf, contato_nome, hashed, 'LOCATARIO_MASTER', cnpj_cpf, contato_nome]);
      }
      
      await logAction((req as any).authUser.username, 'UPDATE_LOCATARIO', 'Atualizou locatário ID ' + id);
      res.json({ success: true });
    } catch(err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError('Essas informações de contato ou CNPJ já estão em uso.', 400);
      }
      throw err;
    } finally { connection.release(); }
  }));

  app.delete('/api/locatarios/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      await connection.query('DELETE FROM md_locatarios WHERE id=?', [id]);
      await logAction((req as any).authUser.username, 'DELETE_LOCATARIO', 'Excluiu locatário ID ' + id);
      res.json({ success: true });
    } finally { connection.release(); }
  }));

  // 2. Tipo Equipamentos
  app.get('/api/tipo-equipamentos', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER', 'LOCATARIO']), asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT t.*, (SELECT COUNT(*) FROM md_equipamentos e WHERE e.tipo_id = t.id) as em_uso FROM md_tipo_equipamentos t ORDER BY t.nome ASC');
      res.json(rows);
    } finally { connection.release(); }
  }));

  app.post('/api/tipo-equipamentos', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { nome } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.query('INSERT INTO md_tipo_equipamentos (nome) VALUES (?)', [nome]);
      await logAction((req as any).authUser.username, 'CREATE_TIPO_EQUIPAMENTO', 'Criou tipo ' + nome);
      res.json({ success: true });
    } finally { connection.release(); }
  }));

  app.put('/api/tipo-equipamentos/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    const connection = await pool.getConnection();
    try {
      const [usage]: any = await connection.query('SELECT COUNT(*) as c FROM md_equipamentos WHERE tipo_id = ?', [id]);
      if (usage[0].c > 0) throw new ApiError('Não é possível editar este tipo pois ele já está em uso.', 400);

      await connection.query('UPDATE md_tipo_equipamentos SET nome=? WHERE id=?', [nome, id]);
      await logAction((req as any).authUser.username, 'UPDATE_TIPO_EQUIPAMENTO', 'Atualizou tipo ID ' + id);
      res.json({ success: true });
    } finally { connection.release(); }
  }));

  // 3. Equipamentos (Cadastro Principal)
  app.get('/api/equipamentos', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER', 'LOCATARIO']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT eq.*, te.nome as tipo_nome, lo.nome as locatario_nome, (SELECT COUNT(*) FROM md_dispositivos d WHERE d.equipamento = eq.codigo) as totalOs FROM md_equipamentos eq LEFT JOIN md_tipo_equipamentos te ON eq.tipo_id = te.id LEFT JOIN md_locatarios lo ON eq.locatario_cnpj = lo.cnpj_cpf';
      let params: any[] = [];
      if (user.role.startsWith('LOCATARIO')) {
         query += ' WHERE eq.locatario_cnpj = ?';
         params = [user.locatario_cnpj];
      }
      const [rows] = await connection.query(query, params);
      res.json(rows);
    } finally { connection.release(); }
  }));

  app.post('/api/equipamentos', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { nome, codigo, tipo_id, locatario_cnpj, ativo } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.query('INSERT INTO md_equipamentos (nome, codigo, tipo_id, locatario_cnpj, ativo) VALUES (?, ?, ?, ?, ?)', 
        [nome || null, codigo, tipo_id, locatario_cnpj, ativo ?? true]);
      await logAction((req as any).authUser.username, 'CREATE_EQUIPAMENTO', 'Criou equipamento ' + codigo);
      res.json({ success: true });
    } finally { connection.release(); }
  }));
  
  app.put('/api/equipamentos/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nome, codigo, tipo_id, locatario_cnpj, ativo } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.query('UPDATE md_equipamentos SET nome=?, codigo=?, tipo_id=?, locatario_cnpj=?, ativo=? WHERE id=?', 
        [nome || null, codigo, tipo_id, locatario_cnpj, ativo ?? true, id]);
      await logAction((req as any).authUser.username, 'UPDATE_EQUIPAMENTO', 'Atualizou equipamento ' + id);
      res.json({ success: true });
    } finally { connection.release(); }
  }));

  app.delete('/api/equipamentos/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      await connection.query('DELETE FROM md_equipamentos WHERE id=?', [id]);
      await logAction((req as any).authUser.username, 'DELETE_EQUIPAMENTO', 'Deletou equipamento ' + id);
      res.json({ success: true });
    } finally { connection.release(); }
  }));

  // 4. Usuários
  app.get('/api/usuarios', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER', 'LOCATARIO']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT u.id, u.username, u.role, u.locatario_cnpj, u.nome, u.senha_padrao, u.ativo, l.nome as locatario_nome FROM md_app_users u LEFT JOIN md_locatarios l ON u.locatario_cnpj = l.cnpj_cpf';
      let params: any[] = [];
      if (user.role.startsWith('LOCATARIO')) {
         query += " WHERE u.locatario_cnpj = ?";
         params = [user.locatario_cnpj];
      }
      query += ' ORDER BY u.nome ASC';
      const [rows] = await connection.query(query, params);
      res.json(rows);
    } finally { connection.release(); }
  }));

  app.post('/api/usuarios', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const { username, password, role, locatario_cnpj, nome } = req.body;
    
    // Auth logic
    if (user.role === 'LOCATARIO_MASTER') {
       if (role !== 'LOCATARIO_MASTER' && role !== 'LOCATARIO') throw new ApiError('Role inválida', 403);
       if (locatario_cnpj !== user.locatario_cnpj) throw new ApiError('Você não pode associar à outra empresa', 403);
    }
    
    const connection = await pool.getConnection();
    try {
      const [existing]: any = await connection.query('SELECT id FROM md_app_users WHERE username = ?', [username]);
      if (existing.length > 0) {
        throw new ApiError('Este email já está em uso.', 400);
      }

      const hashed = await bcrypt.hash(password || 'senha123', 10);
      await connection.query('INSERT INTO md_app_users (username, password, role, locatario_cnpj, nome) VALUES (?, ?, ?, ?, ?)', 
        [username, hashed, role, locatario_cnpj || null, nome]);
      await logAction(user.username, 'CREATE_USUARIO', 'Criou usuário ' + username);
      res.json({ success: true });
    } catch(err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError('Este email já está em uso.', 400);
      }
      throw err;
    } finally { connection.release(); }
  }));

  app.put('/api/usuarios/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const { id } = req.params;
    const { username, password, role, locatario_cnpj, nome, senha_padrao, ativo } = req.body;
    
    // Auth logic
    if (user.role === 'LOCATARIO_MASTER') {
       if (Number(id) === user.id && ativo === false) throw new ApiError('Você não pode se bloquear.', 400);
       if (role !== 'LOCATARIO_MASTER' && role !== 'LOCATARIO') throw new ApiError('Role inválida', 403);
       if (locatario_cnpj !== user.locatario_cnpj) throw new ApiError('Você não pode associar à outra empresa', 403);
    }
    
    const connection = await pool.getConnection();
    try {
      if (user.role === 'LOCATARIO_MASTER') {
         // check if user belongs to same company
         const [ucheck]: any = await connection.query('SELECT locatario_cnpj FROM md_app_users WHERE id = ?', [id]);
         if (!ucheck.length || ucheck[0].locatario_cnpj !== user.locatario_cnpj) {
            throw new ApiError('Sem permissão para editar este usuário', 403);
         }
      }

      if (password) {
        const hashed = await bcrypt.hash(password, 10);
        await connection.query('UPDATE md_app_users SET username=?, password=?, role=?, locatario_cnpj=?, nome=?, senha_padrao=?, ativo=? WHERE id=?', 
          [username, hashed, role, locatario_cnpj || null, nome, senha_padrao, ativo ?? true, id]);
      } else {
        await connection.query('UPDATE md_app_users SET username=?, role=?, locatario_cnpj=?, nome=?, senha_padrao=?, ativo=? WHERE id=?', 
          [username, role, locatario_cnpj || null, nome, senha_padrao, ativo ?? true, id]);
      }
      await logAction(user.username, 'UPDATE_USUARIO', 'Atualizou usuário ' + id);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError('Este email já está em uso.', 400);
      }
      throw err;
    } finally { connection.release(); }
  }));

  app.delete('/api/usuarios/:id', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const { id } = req.params;
    if (user.role === 'LOCATARIO_MASTER' && Number(id) === user.id) throw new ApiError('Você não pode apagar a si mesmo.', 400);

    const connection = await pool.getConnection();
    try {
      if (user.role === 'LOCATARIO_MASTER') {
         // check if user belongs to same company
         const [ucheck]: any = await connection.query('SELECT locatario_cnpj FROM md_app_users WHERE id = ?', [id]);
         if (!ucheck.length || ucheck[0].locatario_cnpj !== user.locatario_cnpj) {
            throw new ApiError('Sem permissão para apagar este usuário', 403);
         }
      }

      await connection.query('DELETE FROM md_app_users WHERE id=?', [id]);
      await logAction(user.username, 'DELETE_USUARIO', 'Deletou usuário ' + id);
      res.json({ success: true });
    } finally { connection.release(); }
  }));
  
  app.get('/api/admin/backup/csv', checkRole(['LOCADOR_MASTER']), asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();
    const Papa = (await import('papaparse')).default;
    try {
      const tables = ['md_app_users', 'md_locatarios', 'md_tipo_equipamentos', 'md_equipamentos', 'md_dispositivos', 'md_logs'];
      let output = "";
      for (const table of tables) {
        const [rows]: any = await connection.query(`SELECT * FROM ${table}`);
        if (rows.length === 0) continue;
        
        output += `---TABLE---,${table}\n`;
        output += Papa.unparse(rows) + '\n\n';
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=backup.csv');
      res.send(output);
    } finally {
      connection.release();
    }
  }));

  app.post('/api/admin/restore/csv', checkRole(['LOCADOR_MASTER']), asyncHandler(async (req, res) => {
    const { csv } = req.body;
    if (!csv) throw new ApiError('Conteúdo CSV não fornecido', 400);

    const connection = await pool.getConnection();
    const Papa = (await import('papaparse')).default;

    try {
        await connection.beginTransaction();
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        const tablesToClear = ['md_app_users', 'md_locatarios', 'md_tipo_equipamentos', 'md_equipamentos', 'md_dispositivos', 'md_logs'];
        for (const t of tablesToClear) await connection.query(`TRUNCATE TABLE ${t}`);
        
        const lines = csv.split('\n');
        let currentTable = '';
        let currentTableLines: string[] = [];

        const processTableBatch = async (table: string, csvLines: string[]) => {
            if (!table || csvLines.length === 0) return;
            const parsed = Papa.parse(csvLines.join('\n'), { header: true });
            if (parsed.data.length === 0) return;
            
            const headers = parsed.meta.fields;
            if (!headers || headers.length === 0) return;

            const placeholders = headers.map(() => '?').join(',');
            const hNames = headers.map(h => `\`${h}\``).join(',');
            
            for (const row of parsed.data as any[]) {
                if (Object.keys(row).length < headers.length) continue;
                const vals = headers.map(h => row[h] === '' ? null : row[h]);
                if (vals.some(v => v !== null)) { 
                    await connection.query(`INSERT INTO ${table} (${hNames}) VALUES (${placeholders})`, vals);
                }
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('---TABLE---')) {
                // finish previous
                await processTableBatch(currentTable, currentTableLines);
                const parts = line.split(',');
                currentTable = parts[1];
                currentTableLines = [];
            } else if (currentTable && line) {
                currentTableLines.push(lines[i]);
            }
        }
        await processTableBatch(currentTable, currentTableLines);
        
        await connection.commit();
        res.json({ success: true, message: 'Restore concluído com sucesso.' });
    } catch(err: any) {
        await connection.rollback();
        throw new ApiError('Erro ao restaurar banco (CSV): ' + err.message, 500);
    } finally {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        connection.release();
    }
  }));

  app.get('/api/logs', checkRole(['LOCADOR_MASTER', 'LOCADOR']), asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT * FROM md_logs ORDER BY data_hora DESC LIMIT 500');
      res.json(rows);
    } finally { connection.release(); }
  }));

  // 5. Telemetria (Para Locatários visualizarem - O.S.)
  app.get('/api/telemetria', checkRole(['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER', 'LOCATARIO']), asyncHandler(async (req, res) => {
    const user = (req as any).authUser;
    const { locatario_cnpj, equipamento, data_inicio, data_fim } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT d.*, eq.locatario_cnpj, eq.nome as equip_nome, loc.nome as locatario_nome
        FROM md_dispositivos d 
        LEFT JOIN md_equipamentos eq ON d.equipamento = eq.codigo
        LEFT JOIN md_locatarios loc ON eq.locatario_cnpj = loc.cnpj_cpf
        WHERE 1=1
      `;
      let params: any[] = [];
      
      if (user.role.startsWith('LOCATARIO')) {
         query += ' AND eq.locatario_cnpj = ?';
         params.push(user.locatario_cnpj);
      } else if (locatario_cnpj) {
         query += ' AND eq.locatario_cnpj = ?';
         params.push(locatario_cnpj);
      }

      if (equipamento) {
        query += ' AND d.equipamento = ?';
        params.push(equipamento);
      }

      if (data_inicio) {
        query += ' AND d.data_leitura >= ?';
        params.push(data_inicio);
      }

      if (data_fim) {
        query += ' AND d.data_leitura <= ?';
        params.push(data_fim);
      }

      query += ' ORDER BY d.data_leitura DESC, d.hora_leitura DESC';
      
      // Limit to 1000 items only if no specific date filter is used to prevent huge payloads
      if (!data_inicio && !data_fim) {
         query += ' LIMIT 1000';
      }

      const [rows] = await connection.query(query, params);
      res.json(rows);
    } finally { connection.release(); }
  }));

  // --- End API Routes ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get('/tmo', (req, res) => res.redirect('/tmo/'));
    app.use(vite.middlewares);
    app.get('/tmo/*', (req, res, next) => {
      req.url = '/';
      vite.middlewares(req, res, next);
    });
    app.get('/', (req, res) => res.redirect('/tmo/'));
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/tmo', express.static(distPath));
    app.get('/tmo/*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('/tmo', (req, res) => res.redirect('/tmo/'));
    app.get('/', (req, res) => res.redirect('/tmo/'));
  }

  // Centralized Error Handling Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Erro interno no servidor';
    let code = err.code || 'INTERNAL_ERROR';

    // Global Database Errors Handlers
    if (err.message) {
      if (err.message.includes('Access denied')) {
        statusCode = 401;
        message = 'Erro de Autenticação no Banco: Verifique sua DATABASE_URL no painel de Secrets.';
        code = 'DB_AUTH_FAILED';
      } else if (err.message.includes('getaddrinfo EAI_AGAIN') || err.message.includes('ENOTFOUND')) {
        statusCode = 500;
        message = 'Erro ao conectar ao Banco de Dados (Host não encontrado). Verifique se a URL no painel de Secrets está correta.';
        code = 'DB_HOST_NOT_FOUND';
      } else if (err.message.includes('Unknown column')) {
        statusCode = 500;
        message = `Erro de schema de banco: ${err.message}.`;
        code = 'DB_SCHEMA_ERROR';
      }
    }

    res.status(statusCode).json({ error: message, code });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

startServer();
