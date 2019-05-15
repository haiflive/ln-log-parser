export namespace AppConfig {
  export const MYSQL_HOST: string     = process.env.MYSQL_HOST ? process.env.MYSQL_HOST : 'localhost';
  export const MYSQL_USER: string     = 'root';
  export const MYSQL_PASSWORD: string = 'root';
  export const MYSQL_DATABASE: string = 'linin';
  export const MYSQL_SOCKET_PATH: string = '';

  export const REDIS_HIT_HOST: string       = process.env.REDIS_HOST ? process.env.REDIS_HOST : '127.0.0.1';
  export const REDIS_HIT_DB: number         = 0;
  export const REDIS_HIT_PORT: number       = process.env.REDIS_PORT ? +process.env.REDIS_PORT : 6379;
  export const REDIS_HIT_CLUSTER_ID: string = 'none';
  export const REDIS_HIT_CHANEL: string = "hit_store";
  export const REDIS_HIT_EXPIRE_TIME: number = 31*60*60;; // seconds to flush redis hits
}