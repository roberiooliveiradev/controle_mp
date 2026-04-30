// src/app/ui/chat/MessageBubble.jsx
import { downloadFileApi } from "../../api/filesApi";

import { REQUEST_ITEM_FIELD_META } from "../requests/requestItemFields.schema";
import { FIELD_TYPES } from "../../constants";
import "./MessageBubble.css";

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

  (fields || []).forEach((field) => {
    map[field.field_tag] = field.field_value ?? "";
  });

  return map;
}

function parseSuppliers(jsonStr) {
  if (!jsonStr) return [];

  try {
    const value = JSON.parse(jsonStr);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* UI Pieces                                                                  */
/* -------------------------------------------------------------------------- */

function ReadonlyInput({ label, value }) {
  return (
    <div className="cmp-readonly-field">
      <div className="cmp-readonly-field__label">{label}</div>

      <div className="cmp-readonly-field__value">
        {value || <span className="cmp-readonly-field__empty">—</span>}
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

  const typeName = item?.request_type?.type_name || `#${item.request_type_id}`;
  const statusName =
    item?.request_status?.status_name || `#${item.request_status_id}`;

  const fieldMetaList = Object.values(REQUEST_ITEM_FIELD_META);

  const suppliersMeta = REQUEST_ITEM_FIELD_META.fornecedores;
  const suppliers = parseSuppliers(fieldMap[suppliersMeta.tag]);

  return (
    <article className="cmp-request-readonly-card">
      <header className="cmp-request-readonly-card__header">
        <strong className="cmp-request-readonly-card__title">
          Solicitação · Item #{index + 1}
        </strong>

        <div className="cmp-request-readonly-card__badges">
          <span className="cmp-request-readonly-card__badge">
            Tipo: {typeName}
          </span>

          <span className="cmp-request-readonly-card__badge">
            Status: {statusName}
          </span>
        </div>
      </header>

      <div className="cmp-request-readonly-card__fields">
        {fieldMetaList
          .filter((meta) => meta.field_type_id === FIELD_TYPES.TEXT)
          .filter((meta) => {
            if (meta.tag === "codigo_atual") {
              return item?.request_type_id === REQUEST_TYPE_ID_UPDATE;
            }

            return true;
          })
          .map((meta) => {
            const isDescription = meta.tag === "descricao";

            return (
              <div
                key={meta.tag}
                className={
                  isDescription
                    ? "cmp-request-readonly-card__field cmp-request-readonly-card__field--full"
                    : "cmp-request-readonly-card__field"
                }
              >
                <ReadonlyInput label={meta.label} value={fieldMap[meta.tag]} />
              </div>
            );
          })}
      </div>

      <section className="cmp-request-readonly-card__suppliers">
        <div className="cmp-request-readonly-card__section-title">
          {suppliersMeta.label}
        </div>

        {suppliers.length === 0 ? (
          <div className="cmp-request-readonly-card__empty">—</div>
        ) : (
          <div className="cmp-request-readonly-card__table-wrap">
            <table className="cmp-request-readonly-card__table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Loja</th>
                  <th>Fornecedor</th>
                  <th>Part number</th>
                  <th>Código do Catálogo</th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map((row, index) => (
                  <tr key={index}>
                    <td>{row.supplier_code || "—"}</td>
                    <td>{row.store || "—"}</td>
                    <td>{row.supplier_name || "—"}</td>
                    <td>{row.part_number || "—"}</td>
                    <td>{row.catalog_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Request Stack                                                              */
/* -------------------------------------------------------------------------- */

function RequestReadonlyStack({ requestFull }) {
  const items = requestFull?.items || [];

  if (!items.length) return null;

  return (
    <div className="cmp-request-readonly-stack">
      {items.map((item, index) => (
        <RequestItemReadonlyCard
          key={item.id ?? index}
          item={item}
          index={index}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Attachments                                                        */
/* -------------------------------------------------------------------------- */

function MessageAttachment({ file, index, onDownload }) {
  const isImage = (file.content_type || "").startsWith("image/");
  const preview = file._local_preview_url;

  return (
    <article className="cmp-message-attachment">
      <div className="cmp-message-attachment__preview">
        {isImage && preview ? (
          <img
            src={preview}
            alt={file.original_name}
            className="cmp-message-attachment__image"
          />
        ) : (
          <span className="cmp-message-attachment__label">
            {fileLabel(file.original_name)}
          </span>
        )}
      </div>

      <div className="cmp-message-attachment__body">
        <div className="cmp-message-attachment__name" title={file.original_name}>
          {file.original_name}
        </div>

        <button
          type="button"
          disabled={!file.id}
          onClick={() => onDownload(file)}
          className="cmp-message-attachment__download"
        >
          {file.id ? "Baixar" : "Pendente"}
        </button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Bubble                                                             */
/* -------------------------------------------------------------------------- */

export function MessageBubble({ message, isMine }) {
  const date = message.created_at ? new Date(message.created_at) : null;
  const status = message._status ?? (isMine ? "sent" : "received");
  const files = Array.isArray(message.files) ? message.files : [];

  async function handleDownload(file) {
    if (!file?.id) return;

    try {
      await downloadFileApi(file.id, file.original_name || "arquivo");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error ?? "Falha ao baixar arquivo.");
    }
  }

  return (
    <div
      className={
        isMine
          ? "cmp-message-bubble-row cmp-message-bubble-row--mine"
          : "cmp-message-bubble-row"
      }
    >
      <article
        className={
          status === "sending"
            ? "cmp-message-bubble cmp-message-bubble--sending"
            : isMine
              ? "cmp-message-bubble cmp-message-bubble--mine"
              : "cmp-message-bubble"
        }
      >
        {!isMine && (
          <div className="cmp-message-bubble__sender">
            {message.sender?.full_name ?? message.sender?.email}
          </div>
        )}

        {message.body ? (
          <div className="cmp-message-bubble__body">{message.body}</div>
        ) : null}

        {message.request_full ? (
          <RequestReadonlyStack requestFull={message.request_full} />
        ) : null}

        {files.length > 0 && (
          <div className="cmp-message-bubble__attachments">
            {files.map((file, index) => (
              <MessageAttachment
                key={file.id ?? `${file.original_name}-${index}`}
                file={file}
                index={index}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}

        <footer className="cmp-message-bubble__footer">
          <span>{date ? date.toLocaleString("pt-BR") : ""}</span>
          {isMine && <span>{myStatusLabel(status)}</span>}
        </footer>
      </article>
    </div>
  );
}