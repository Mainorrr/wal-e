import { Parser } from 'node-sql-parser';
import type { DataSnapshot } from '../types';

export type MutationOp = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ParsedMutation {
  op: MutationOp;
  tableOrCollection: string;
  setClause?: Record<string, unknown>;
  insertValues?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  isMongo: boolean;
}

const parser = new Parser();
const MUTATION_METHODS = new Set(['insertone', 'insertmany', 'updateone', 'updatemany', 'deleteone', 'deletemany', 'replaceone']);

function parseMongoArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

function parseMongoMutation(mongoMatch: RegExpMatchArray): ParsedMutation {
  const collection = mongoMatch[1];
  const method = mongoMatch[2];
  const argsStr = mongoMatch[3];
  const args = parseMongoArgs(argsStr);
  const filter = parseJsonSafe(args[0] || '{}');
  const update = args[1] ? parseJsonSafe(args[1]) : undefined;

  if (method === 'insertOne' || method === 'insertMany') {
    return {
      op: 'INSERT',
      tableOrCollection: collection,
      insertValues: filter,
      isMongo: true,
    };
  }
  if (method === 'updateOne' || method === 'updateMany') {
    return {
      op: 'UPDATE',
      tableOrCollection: collection,
      setClause: update?.$set || update || {},
      filter: filter,
      isMongo: true,
    };
  }
  if (method === 'deleteOne' || method === 'deleteMany') {
    return {
      op: 'DELETE',
      tableOrCollection: collection,
      filter: filter,
      isMongo: true,
    };
  }
  return { op: 'DELETE', tableOrCollection: collection, isMongo: true };
}

function getTableName(table: string | string[]): string {
  if (Array.isArray(table)) return table[0] || '';
  return table || '';
}

function parseSetClauseFromAST(setList: Array<{column: string; value: unknown}> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!setList) return result;
  for (const item of setList) {
    result[item.column] = item.value;
  }
  return result;
}

function parseWhereClauseSimple(whereStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const conditions = whereStr.split(/\s+AND\s+/i);
  for (const cond of conditions) {
    const match = cond.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      result[match[1].trim()] = parseValue(match[2].trim());
    }
  }
  return result;
}

function parseValue(valStr: string): unknown {
  valStr = valStr.trim();
  if (valStr === 'NULL' || valStr === 'null') return null;
  if (valStr === 'true' || valStr === 'TRUE') return true;
  if (valStr === 'false' || valStr === 'FALSE') return false;
  if (/^-?\d+$/.test(valStr)) return parseInt(valStr, 10);
  if (/^-?\d+\.\d+$/.test(valStr)) return parseFloat(valStr);
  if ((valStr.startsWith("'") && valStr.endsWith("'")) || (valStr.startsWith('"') && valStr.endsWith('"'))) {
    return valStr.slice(1, -1);
  }
  if (valStr.startsWith('[') || valStr.startsWith('{')) {
    try {
      return JSON.parse(valStr);
    } catch {
      return valStr;
    }
  }
  return valStr;
}

export function isMutationQuery(query: string): boolean {
  const trimmed = query.trim();

  const mongoMatch = trimmed.match(/^db\.(\w+)\.(\w+)/i);
  if (mongoMatch) {
    return MUTATION_METHODS.has(mongoMatch[2].toLowerCase());
  }

  try {
    const ast = parser.astify(trimmed);
    const type = ast.type?.toLowerCase();
    return type === 'update' || type === 'insert' || type === 'delete';
  } catch {
    return false;
  }
}

export function parseMutationQuery(query: string): ParsedMutation | null {
  const trimmed = query.trim();

  const mongoMutationMatch = trimmed.match(/^db\.(\w+)\.(updateOne|updateMany|insertOne|insertMany|deleteOne|deleteMany)\(([\s\S]*)\)$/is);
  if (mongoMutationMatch) {
    return parseMongoMutation(mongoMutationMatch);
  }

  try {
    const ast = parser.astify(trimmed);
    const type = ast.type?.toLowerCase();

    if (type === 'update') {
      const setClause = parseSetClauseFromAST(ast.set);
      const whereStr = ast.where ? reconstructWhere(ast.where) : '';
      const filter = whereStr ? parseWhereClauseSimple(whereStr) : undefined;
      return {
        op: 'UPDATE',
        tableOrCollection: getTableName(ast.table),
        setClause,
        filter,
        isMongo: false,
      };
    }

    if (type === 'insert') {
      const columns = ast.columns as string[] || [];
      const values = ast.values;
      const insertValues: Record<string, unknown> = {};
      const valueRow = Array.isArray(values?.[0]) ? values[0] : values;
      if (Array.isArray(valueRow)) {
        columns.forEach((col: string, i: number) => {
          insertValues[col] = valueRow[i];
        });
      }
      return {
        op: 'INSERT',
        tableOrCollection: getTableName(ast.table),
        insertValues,
        isMongo: false,
      };
    }

    if (type === 'delete') {
      const whereStr = ast.where ? reconstructWhere(ast.where) : '';
      const filter = whereStr ? parseWhereClauseSimple(whereStr) : undefined;
      return {
        op: 'DELETE',
        tableOrCollection: getTableName(ast.from),
        filter,
        isMongo: false,
      };
    }
  } catch {
    // Fall through to return null
  }

  return null;
}

function reconstructWhere(whereAST: unknown): string {
  if (!whereAST) return '';
  if (typeof whereAST === 'string') return whereAST;
  try {
    return JSON.stringify(whereAST);
  } catch {
    return '';
  }
}

export function buildBeforeImageQuery(parsed: ParsedMutation): string {
  if (parsed.isMongo) {
    return `db.${parsed.tableOrCollection}.findOne(${JSON.stringify(parsed.filter || {})})`;
  }
  if (parsed.op === 'INSERT') return '';
  let sql = `SELECT * FROM ${parsed.tableOrCollection}`;
  if (parsed.filter && Object.keys(parsed.filter).length > 0) {
    const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
      if (v === null) return `${k} IS NULL`;
      if (typeof v === 'string') return `${k} = '${v}'`;
      return `${k} = ${v}`;
    });
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }
  return sql;
}

export function buildAfterImage(beforeImage: DataSnapshot, parsed: ParsedMutation): DataSnapshot {
  if (parsed.op === 'INSERT') {
    return parsed.insertValues || null;
  }
  if (parsed.op === 'DELETE') {
    return null;
  }
  if (parsed.op === 'UPDATE' && beforeImage && parsed.setClause) {
    return { ...beforeImage, ...parsed.setClause };
  }
  return beforeImage;
}

export function buildMutationSql(parsed: ParsedMutation): string {
  if (parsed.isMongo) {
    switch (parsed.op) {
      case 'INSERT':
        return `db.${parsed.tableOrCollection}.insertOne(${JSON.stringify(parsed.insertValues || {})})`;
      case 'UPDATE':
        return `db.${parsed.tableOrCollection}.updateOne(${JSON.stringify(parsed.filter || {})}, ${JSON.stringify({ $set: parsed.setClause || {} })})`;
      case 'DELETE':
        return `db.${parsed.tableOrCollection}.deleteOne(${JSON.stringify(parsed.filter || {})})`;
    }
  }
  switch (parsed.op) {
    case 'INSERT': {
      const cols = parsed.insertValues ? Object.keys(parsed.insertValues) : [];
      const vals = parsed.insertValues ? Object.values(parsed.insertValues).map((v) => {
        if (v === null) return 'NULL';
        if (typeof v === 'string') return `'${v}'`;
        return String(v);
      }) : [];
      return `INSERT INTO ${parsed.tableOrCollection} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
    }
    case 'UPDATE': {
      const setParts = parsed.setClause ? Object.entries(parsed.setClause).map(([k, v]) => {
        if (v === null) return `${k} = NULL`;
        if (typeof v === 'string') return `${k} = '${v}'`;
        return `${k} = ${v}`;
      }) : [];
      let sql = `UPDATE ${parsed.tableOrCollection} SET ${setParts.join(', ')}`;
      if (parsed.filter && Object.keys(parsed.filter).length > 0) {
        const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
          if (v === null) return `${k} IS NULL`;
          if (typeof v === 'string') return `${k} = '${v}'`;
          return `${k} = ${v}`;
        });
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }
      return sql;
    }
    case 'DELETE': {
      let sql = `DELETE FROM ${parsed.tableOrCollection}`;
      if (parsed.filter && Object.keys(parsed.filter).length > 0) {
        const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
          if (v === null) return `${k} IS NULL`;
          if (typeof v === 'string') return `${k} = '${v}'`;
          return `${k} = ${v}`;
        });
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }
      return sql;
    }
  }
  return '';
}