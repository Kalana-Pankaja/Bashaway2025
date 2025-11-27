#include <stdio.h>
#include <stdlib.h>
#include <libpq-fe.h>

int main() {
    const char *conninfo = "host=localhost port=5432 dbname=vectordb user=postgres password=bashaway2025";
    PGconn *conn = PQconnectdb(conninfo);
    
    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "Connection failed: %s", PQerrorMessage(conn));
        PQfinish(conn);
        return 1;
    }
    
    // Create table
    PGresult *res = PQexec(conn, 
        "CREATE TABLE IF NOT EXISTS embeddings (id SERIAL PRIMARY KEY, vec vector(3))");
    
    if (PQresultStatus(res) != PGRES_COMMAND_OK) {
        fprintf(stderr, "CREATE TABLE failed: %s", PQerrorMessage(conn));
        PQclear(res);
        PQfinish(conn);
        return 1;
    }
    PQclear(res);
    
    // Insert vectors
    const char *vectors[] = {
        "[1.0, 2.0, 3.0]",
        "[4.0, 5.0, 6.0]",
        "[7.0, 8.0, 9.0]"
    };
    
    for (int i = 0; i < 3; i++) {
        char query[256];
        snprintf(query, sizeof(query), "INSERT INTO embeddings (vec) VALUES ('%s')", vectors[i]);
        res = PQexec(conn, query);
        
        if (PQresultStatus(res) != PGRES_COMMAND_OK) {
            fprintf(stderr, "INSERT failed: %s", PQerrorMessage(conn));
            PQclear(res);
            PQfinish(conn);
            return 1;
        }
        PQclear(res);
    }
    
    printf("Successfully inserted %d vectors\n", 3);
    
    PQfinish(conn);
    return 0;
}

