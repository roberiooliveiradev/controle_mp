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
                    LTRIM(RTRIM(B1_REFEREN))   AS ref_cliente,

                    (
                        SELECT
                            LTRIM(RTRIM(A5_FORNECE))  AS supplier_code,
                            LTRIM(RTRIM(A5_LOJA))     AS store,
                            LTRIM(RTRIM(A5_NOMEFOR))  AS supplier_name,
                            LTRIM(RTRIM(A5_CODPRF))   AS part_number
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


def _deep_strip(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return [_deep_strip(v) for v in value]
    if isinstance(value, dict):
        return {k: _deep_strip(v) for k, v in value.items()}
    return value
