# app/repositories/totvs_product_repository.py
from sqlalchemy import text
from app.infrastructure.database.totvs_connection import TotvsSessionLocal


class TotvsProductRepository:
    def list_products(self, *, code: str | None = None) -> list[dict]:
        with TotvsSessionLocal() as session:
            sql = """
                SELECT 
                    LTRIM(RTRIM(B1_COD))       AS codigo,
                    LTRIM(RTRIM(B1_GRUPO))     AS grupo,
                    LTRIM(RTRIM(B1_TIPO))      AS tipo,
                    LTRIM(RTRIM(B1_DESC))      AS descricao,
                    LTRIM(RTRIM(B1_LOCPAD))    AS armazem_padrao,
                    LTRIM(RTRIM(B1_UM))        AS unidade,
                    LTRIM(RTRIM(B1_TPMAT))     AS produto_terceiro,
                    LTRIM(RTRIM(B1_CONTA))     AS cta_contabil,
                    LTRIM(RTRIM(B1_REFEREN))   AS ref_cliente,

                    (
                        SELECT
                            LTRIM(RTRIM(A5_FORNECE))  AS supplier_code,
                            LTRIM(RTRIM(A5_LOJA))     AS store,
                            LTRIM(RTRIM(A5_NOMEFOR))  AS supplier_name,
                            LTRIM(RTRIM(A5_CODPRF))   AS part_number,
                            LTRIM(RTRIM(A5_CODPRCA))   AS catalog_number
                        FROM SA5010
                        WHERE
                            SA5010.D_E_L_E_T_ = ''
                            AND SA5010.A5_PRODUTO = SB1010.B1_COD
                        FOR JSON PATH
                    ) AS fornecedores

                FROM SB1010
                WHERE SB1010.D_E_L_E_T_ = ''
            """

            params = {}
            if code:
                sql += " AND SB1010.B1_COD = :code"
                params["code"] = code.strip()

            result = session.execute(text(sql), params)
            rows = [dict(row._mapping) for row in result]
            return [_deep_strip(r) for r in rows]
        
            
    def search_suppliers(
        self,
        *,
        code: str | None = None,
        store: str | None = None,
        name: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        safe_limit = max(1, min(int(limit or 20), 50))
        safe_offset = max(0, int(offset or 0))

        where = """
            WHERE
                SA2010.D_E_L_E_T_ = ''
        """

        params = {}

        if code:
            where += " AND UPPER(LTRIM(RTRIM(A2_COD))) LIKE UPPER(:code)"
            params["code"] = f"%{code.strip()}%"

        if store:
            where += " AND UPPER(LTRIM(RTRIM(A2_LOJA))) LIKE UPPER(:store)"
            params["store"] = f"%{store.strip()}%"

        if name:
            where += " AND UPPER(LTRIM(RTRIM(A2_NOME))) LIKE UPPER(:name)"
            params["name"] = f"%{name.strip()}%"

        with TotvsSessionLocal() as session:
            count_sql = f"""
                SELECT COUNT(1) AS total
                FROM SA2010
                {where}
            """

            total = int(session.execute(text(count_sql), params).scalar() or 0)

            sql = f"""
                SELECT
                    LTRIM(RTRIM(A2_COD))  AS supplier_code,
                    LTRIM(RTRIM(A2_LOJA)) AS store,
                    LTRIM(RTRIM(A2_NOME)) AS supplier_name
                FROM SA2010
                {where}
                ORDER BY
                    A2_COD ASC,
                    A2_LOJA ASC,
                    A2_NOME ASC
                OFFSET {safe_offset} ROWS
                FETCH NEXT {safe_limit} ROWS ONLY
            """

            result = session.execute(text(sql), params)
            rows = [dict(row._mapping) for row in result]
            return [_deep_strip(r) for r in rows], total

def _deep_strip(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return [_deep_strip(v) for v in value]
    if isinstance(value, dict):
        return {k: _deep_strip(v) for k, v in value.items()}
    return value
