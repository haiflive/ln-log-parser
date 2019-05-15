import { Injectable } from '@nestjs/common';
import { createConnection } from 'mysql';

import { AppConfig } from './config/main';

export abstract class DbAbstract {
    protected connection_uri: any;
    protected connection;

    constructor() {}

    protected setupConnection(): Promise<any> {
        let me = this;
        if(!me.connection) {
            return new Promise((resolve, reject) => {
                me.connection = createConnection(me.connection_uri);
                me.connection.connect(function(err) {
                    if (err) {
                        console.error('error connecting: ' + err.message);
                        reject();
                        return;
                    }

                    console.log('connected as id ' + me.connection.threadId);
                    resolve();
                });
            });
        }

        return Promise.resolve();
        
    }

    async query(sql: any, values: any = []): Promise<any> {
        await this.setupConnection();

        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (error: any, results: any, fields: any) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    }
}

export class DbAdmin extends DbAbstract {
    constructor() {
        super();

        this.connection_uri = {
            host     : AppConfig.MYSQL_HOST,
            user     : AppConfig.MYSQL_USER,
            password : AppConfig.MYSQL_PASSWORD,
            database : AppConfig.MYSQL_DATABASE,
            socketPath: AppConfig.MYSQL_SOCKET_PATH
        };
    }
}

export enum DB_CONNECTION {
    ADMIN = 0,
    // IP2LOCATION
  }

@Injectable()
export class DbService {
    protected db_admin: DbAbstract;
    // protected db_ip2location: DbAbstract;

    constructor() {
        this.db_admin       = new DbAdmin;
    }

    use(db_name: DB_CONNECTION) : DbAbstract {
        switch(db_name) {
            case DB_CONNECTION.ADMIN:
                return this.db_admin;
        }
    }
}
