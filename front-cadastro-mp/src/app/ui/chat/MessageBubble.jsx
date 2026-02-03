// src/app/ui/chat/MessageBubble.jsx
import { downloadFileApi } from "../../api/filesApi";

import { REQUEST_ITEM_FIELD_META } from "../requests/requestItemFields.schema";
import { FIELD_TYPES } from "../../constants";

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

function myStatusLabel(status) {
  if (status === "sending") return "🕓 Enviando";
  if (status === "sent") return "✓ Enviado";
  return "";
}

function fileLabel(originalName) {
  const ext = (originalName || "").split(".").pop();
  if (!ext || ext === originalName) return "ARQ";
  return String(ext).toUpperCase();
}

function buildFieldMap(fields) {
  const map = {};
  (fields || []).forEach((f) => {
    map[f.field_tag] = f.field_value ?? "";
  });
  return map;
}

function parseSuppliers(jsonStr) {
  if (!jsonStr) return [];
  try {
    const v = JSON.parse(jsonStr);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* UI Pieces                                                                  */
/* -------------------------------------------------------------------------- */

function ReadonlyInput({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, opacity: "var(--text-muted)" }}>{label}</div>
      <div
        style={{
          padding: "10px 10px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          whiteSpace: "pre-wrap",
        }}
      >
        {value || <span style={{ opacity: 0.5 }}>—</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Request Item Card                                                          */
/* -------------------------------------------------------------------------- */

const REQUEST_TYPE_ID_UPDATE = 2;

function RequestItemReadonlyCard({ item, index }) {
  const fieldMap = buildFieldMap(item.fields);

  const typeName =
    item?.request_type?.type_name || `#${item.request_type_id}`;
  const statusName =
    item?.request_status?.status_name || `#${item.request_status_id}`;

  const fieldMetaList = Object.values(REQUEST_ITEM_FIELD_META);

  const suppliersMeta = REQUEST_ITEM_FIELD_META.fornecedores;
  const suppliers = parseSuppliers(fieldMap[suppliersMeta.tag]);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        background: "var(--surface)",
        display: "grid",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 800 }}>
          Solicitação • Item #{index + 1}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              fontWeight: 700,
            }}
          >
            Tipo: {typeName}
          </span>

          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            Status: {statusName}
          </span>
        </div>
      </div>

      {/* Campos TEXT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 10,
        }}
      >
        {fieldMetaList
          .filter((meta) => meta.field_type_id === FIELD_TYPES.TEXT)
          .filter((meta) => {
            // regra de negócio: codigo_atual só em UPDATE
            if (meta.tag === "codigo_atual") {
              return item?.request_type_id === REQUEST_TYPE_ID_UPDATE;
            }
            return true;
          })
          .map((meta) => {
            const isDescricao = meta.tag === "descricao";

            return (
              <div
                key={meta.tag}
                style={isDescricao ? { gridColumn: "1 / -1" } : undefined}
              >
                <ReadonlyInput
                  label={meta.label}
                  value={fieldMap[meta.tag]}
                />
              </div>
            );
          })}
      </div>

      {/* Fornecedores (JSON) */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          {suppliersMeta.label}
        </div>

        {suppliers.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>—</div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Código</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Loja</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Fornecedor</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Part number</th>
                  <th style={{ textAlign: "left", padding: 8 }}>
                    Código do Catálogo
                  </th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8 }}>{r.supplier_code || "—"}</td>
                    <td style={{ padding: 8 }}>{r.store || "—"}</td>
                    <td style={{ padding: 8 }}>{r.supplier_name || "—"}</td>
                    <td style={{ padding: 8 }}>{r.part_number || "—"}</td>
                    <td style={{ padding: 8 }}>
                      {r.catalog_number || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Request Stack                                                              */
/* -------------------------------------------------------------------------- */

function RequestReadonlyStack({ requestFull }) {
  const items = requestFull?.items || [];
  if (!items.length) return null;

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {items.map((it, idx) => (
        <RequestItemReadonlyCard
          key={it.id ?? idx}
          item={it}
          index={idx}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Bubble                                                             */
/* -------------------------------------------------------------------------- */

export function MessageBubble({ message, isMine }) {
  const dt = message.created_at ? new Date(message.created_at) : null;
  const status = message._status ?? (isMine ? "sent" : "received");
  const files = Array.isArray(message.files) ? message.files : [];

  async function handleDownload(f) {
    if (!f?.id) return;
    try {
      await downloadFileApi(f.id, f.original_name || "arquivo");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error ?? "Falha ao baixar arquivo.");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: 780,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: isMine ? "var(--surface-2)" : "var(--surface)",
          opacity: status === "sending" ? 0.75 : 1,
        }}
      >
        {!isMine && (
          <div
            style={{
              fontSize: 12,
              opacity: "var(--text-muted)",
              marginBottom: 6,
            }}
          >
            {message.sender?.full_name ?? message.sender?.email}
          </div>
        )}

        {message.body ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>
        ) : null}

        {message.request_full ? (
          <RequestReadonlyStack requestFull={message.request_full} />
        ) : null}

        {/* Arquivos */}
        {files.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {files.map((f, idx) => {
              const isImg = (f.content_type || "").startsWith("image/");
              const preview = f._local_preview_url;

              return (
                <div
                  key={f.id ?? `${f.original_name}-${idx}`}
                  style={{
                    width: 180,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      background: "var(--surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImg && preview ? (
                      <img
                        src={preview}
                        alt={f.original_name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: "var(--text-muted)",
                        }}
                      >
                        {fileLabel(f.original_name)}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 8, display: "grid", gap: 8 }}>
                    <div
                      style={{
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.original_name}
                    </div>

                    <button
                      type="button"
                      disabled={!f.id}
                      onClick={() => handleDownload(f)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: f.id ? "pointer" : "not-allowed",
                        opacity: f.id ? 1 : 0.6,
                        fontSize: 12,
                      }}
                    >
                      Baixar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            opacity: 0.65,
            marginTop: 8,
          }}
        >
          <span>{dt ? dt.toLocaleString("pt-BR") : ""}</span>
          {isMine && <span>{myStatusLabel(status)}</span>}
        </div>
      </div>
    </div>
  );
}
