import { Injectable } from '@nestjs/common';
import { DbService, DB_CONNECTION, DbAbstract } from './db.service';
import { Observable, from, interval, Subscription } from 'rxjs';
import { AppConfig } from './config/main';
import { promisify } from 'util';
import * as fs from 'fs';
import * as es from 'event-stream';
import * as redis from 'redis';


@Injectable()
export class AppService {
  protected is_process_started: boolean;
  protected line_number: number;
  protected data_stack: any[];
  protected domain_list: any;
  protected readonly _db: DbAbstract;
  protected client:any;
  protected getAsync: any;

  constructor(private readonly dbService: DbService,) {
    this._db = this.dbService.use(DB_CONNECTION.ADMIN);

    // setup redis
    this.client = redis.createClient({
      host: AppConfig.REDIS_HIT_HOST,
      db: AppConfig.REDIS_HIT_DB,
      port: AppConfig.REDIS_HIT_PORT,
    });

    this.client.on("error", this.handleError);
    this.getAsync = promisify(this.client.get).bind(this.client);

    this.is_process_started = false;
    this.line_number = 0;
    this.data_stack = [];
    this.domain_list = {};

    this.setupDomainList();
    // this.startProcess(); // debug autostart
  }

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * return process status
   */
  getProcessStatus(): string {
    if(!this.is_process_started) {
      this.is_process_started = true;
      this.startProcess();
      return 'process started';
    }

    return 'lines processed: ' + this.line_number;
  }

  protected startProcess() {
    this.line_number = 0;
    let me = this;

    var s = fs.createReadStream('1.sql')
      .pipe(es.split())
      .pipe(es.mapSync(async function(line) {
          me.line_number += 1; // 14162106
          // skip first 30 lines
          if(me.line_number < 9411764) // 31) // skip imported
            return; // continue
          
          // pause the readstream
          s.pause();

          await me.processLine(line);

          // process line here and call s.resume() when rdy
          // function below was for logging memory usage
          // logMemoryUsage(me.line_number);

          // resume the readstream, possibly from a callback
          s.resume();
        })
        .on('error', function(err){
          console.log('Error while reading file.', err);
        })
        .on('end', function(){
          console.log('Read entire file.')
        })
      );
  }

  /**
   * perse string like:
   * INSERT INTO idemail VALUES ('MEMBER_ID', 'MEMBER_PRIMARY_EMAIL');
   * @param data 
   */
  protected async processLine(data: string) {
    //! need stack by 10000 lines per query

    let data_start: number = data.indexOf('(');
    let data_end: number = data.indexOf(')');
    let result_str = data.substr(data_start+2, data_end - data_start-3 );
    let result_values = result_str.split("', '");
    
    try {
      // check exists domain, add if not exists create
      let email_parts = result_values[1].split('@');
      let domain_zone: number = await this.getDomainId(email_parts[1]);
      result_values.push(domain_zone.toString());

      // pass data into stack
      this.data_stack.push(result_values);
      // console.log(result_values);
    } catch(e) {
      if(e.message == "Cannot read property 'split' of undefined") {
        return;
      }

      console.log(data);

      debugger;
      return; // skip bug
    }

    if(this.data_stack.length > 10000) {
      let data_to_save = this.data_stack;
      this.data_stack = []; // flush stack
      try {
        let results = await this._db.query(
          'INSERT IGNORE INTO `idemail` (`id`, `email`, `domain_id`) '
          + ' VALUES ?',
          [data_to_save]
        );

      } catch(e) {
        console.log(e);
        debugger;
      }
    }
  }

  protected async setupDomainList() {
    try {
      // load full domain list to redis
      let results: any[] = await this._db.query(
        'SELECT id, name FROM `domain`' // LIMIT 100
      );

      for(let i = 0; i < results.length; i++) {
        this.client.set(results[i].name, results[i].id, 'EX', AppConfig.REDIS_HIT_EXPIRE_TIME);
      }
    } catch(e) {
      debugger;
    }

    // test redis search domain
    let domain_id: number = await this.getDomainId('gmail.com');

    console.log(domain_id);

    console.log('Domain list ready');
  }

  /**
   * create domain if not exists
   * @param domain 
   */
  protected async getDomainId(domain: string): Promise<number> {
    // get data from redis
    let domain_id = await this.getAsync(domain);

    // if empty create it
    if(!domain_id) {
      try {
        let results = await this._db.query(
          'INSERT IGNORE INTO `domain` (`name`) '
          + ' VALUES ?',
          [[[domain]]]
        );

        // console.log(results.insertId); // 
        // store new domain to redis
        this.client.set(domain, results.insertId, 'EX', AppConfig.REDIS_HIT_EXPIRE_TIME);
        domain_id = results.insertId;
      } catch(e) {
        console.log(e);
        debugger;
      }
    }

    return +domain_id;
  }

  protected handleError(err) {
    console.log("Error " + err);
  }
}
