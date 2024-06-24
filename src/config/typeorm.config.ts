export interface ITypeORMConfig {
  engine: 'mysql' | 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
}

export default () => ({
  typeorm: {
    engine: process.env.DATABASE_ENGINE,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD || '',
    name: process.env.DATABASE_NAME,
    synchronize: Boolean(process.env.DATABASE_SYNCHRONIZE) || false,
  },
});
