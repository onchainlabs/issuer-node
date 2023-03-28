package api_admin

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/iden3/iden3comm"

	"github.com/polygonid/sh-id-platform/internal/common"
	"github.com/polygonid/sh-id-platform/internal/config"
	"github.com/polygonid/sh-id-platform/internal/core/domain"
	"github.com/polygonid/sh-id-platform/internal/core/ports"
	"github.com/polygonid/sh-id-platform/internal/core/services"
	"github.com/polygonid/sh-id-platform/internal/health"
	"github.com/polygonid/sh-id-platform/internal/log"
	"github.com/polygonid/sh-id-platform/internal/repositories"
	"github.com/polygonid/sh-id-platform/pkg/schema"
)

// Server implements StrictServerInterface and holds the implementation of all API controllers
// This is the glue to the API autogenerated code
type Server struct {
	cfg                *config.Configuration
	identityService    ports.IdentityService
	claimService       ports.ClaimsService
	schemaService      ports.SchemaAdminService
	connectionsService ports.ConnectionsService
	linkService        ports.LinkService
	publisherGateway   ports.Publisher
	packageManager     *iden3comm.PackageManager
	health             *health.Status
}

// NewServer is a Server constructor
func NewServer(cfg *config.Configuration, identityService ports.IdentityService, claimsService ports.ClaimsService, schemaService ports.SchemaAdminService, connectionsService ports.ConnectionsService, linkService ports.LinkService, publisherGateway ports.Publisher, packageManager *iden3comm.PackageManager, health *health.Status) *Server {
	return &Server{
		cfg:                cfg,
		identityService:    identityService,
		claimService:       claimsService,
		schemaService:      schemaService,
		connectionsService: connectionsService,
		linkService:        linkService,
		publisherGateway:   publisherGateway,
		packageManager:     packageManager,
		health:             health,
	}
}

// GetSchema is the UI endpoint that searches and schema by Id and returns it.
func (s *Server) GetSchema(ctx context.Context, request GetSchemaRequestObject) (GetSchemaResponseObject, error) {
	schema, err := s.schemaService.GetByID(ctx, request.Id)
	if errors.Is(err, services.ErrSchemaNotFound) {
		log.Debug(ctx, "schema not found", "id", request.Id)
		return GetSchema404JSONResponse{N404JSONResponse{Message: "schema not found"}}, nil
	}
	if err != nil {
		log.Error(ctx, "loading schema", "err", err, "id", request.Id)
	}
	return GetSchema200JSONResponse(schemaResponse(schema)), nil
}

// GetSchemas returns the list of schemas that match the request.Params.Query filter. If param query is nil it will return all
func (s *Server) GetSchemas(ctx context.Context, request GetSchemasRequestObject) (GetSchemasResponseObject, error) {
	col, err := s.schemaService.GetAll(ctx, request.Params.Query)
	if err != nil {
		return GetSchemas500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}
	return GetSchemas200JSONResponse(schemaCollectionResponse(col)), nil
}

// Health is a method
func (s *Server) Health(_ context.Context, _ HealthRequestObject) (HealthResponseObject, error) {
	var resp Health200JSONResponse = s.health.Status()

	return resp, nil
}

// ImportSchema is the UI endpoint to import schema metadata
func (s *Server) ImportSchema(ctx context.Context, request ImportSchemaRequestObject) (ImportSchemaResponseObject, error) {
	req := request.Body
	if err := guardImportSchemaReq(req); err != nil {
		log.Debug(ctx, "Importing schema bad request", "err", err, "req", req)
		return ImportSchema400JSONResponse{N400JSONResponse{Message: fmt.Sprintf("bad request: %s", err.Error())}}, nil
	}
	schema, err := s.schemaService.ImportSchema(ctx, s.cfg.APIUI.IssuerDID, req.Url, req.SchemaType)
	if err != nil {
		log.Error(ctx, "Importing schema", "err", err, "req", req)
		return ImportSchema500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}
	return ImportSchema201JSONResponse{Id: schema.ID.String()}, nil
}

func guardImportSchemaReq(req *ImportSchemaJSONRequestBody) error {
	if req == nil {
		return errors.New("empty body")
	}
	if strings.TrimSpace(req.Url) == "" {
		return errors.New("empty url")
	}
	if strings.TrimSpace(req.SchemaType) == "" {
		return errors.New("empty type")
	}
	if _, err := url.ParseRequestURI(req.Url); err != nil {
		return fmt.Errorf("parsing url: %w", err)
	}
	return nil
}

// GetDocumentation this method will be overridden in the main function
func (s *Server) GetDocumentation(_ context.Context, _ GetDocumentationRequestObject) (GetDocumentationResponseObject, error) {
	return nil, nil
}

// AuthCallback receives the authentication information of a holder
func (s *Server) AuthCallback(ctx context.Context, request AuthCallbackRequestObject) (AuthCallbackResponseObject, error) {
	if request.Body == nil || *request.Body == "" {
		log.Debug(ctx, "empty request body auth-callback request")
		return AuthCallback400JSONResponse{N400JSONResponse{"Cannot proceed with empty body"}}, nil
	}

	err := s.identityService.Authenticate(ctx, *request.Body, request.Params.SessionID, s.cfg.APIUI.ServerURL, s.cfg.APIUI.IssuerDID)
	if err != nil {
		log.Debug(ctx, "error authenticating", err.Error())
		return AuthCallback500JSONResponse{}, nil
	}

	return AuthCallback200Response{}, nil
}

// AuthQRCode returns the qr code for authenticating a user
func (s *Server) AuthQRCode(ctx context.Context, _ AuthQRCodeRequestObject) (AuthQRCodeResponseObject, error) {
	qrCode, err := s.identityService.CreateAuthenticationQRCode(ctx, s.cfg.APIUI.ServerURL, s.cfg.APIUI.IssuerDID)
	if err != nil {
		return AuthQRCode500JSONResponse{N500JSONResponse{"Unexpected error while creating qr code"}}, nil
	}

	return AuthQRCode200JSONResponse{
		Body: struct {
			CallbackUrl string        `json:"callbackUrl"`
			Reason      string        `json:"reason"`
			Scope       []interface{} `json:"scope"`
		}{
			qrCode.Body.CallbackURL,
			qrCode.Body.Reason,
			[]interface{}{},
		},
		From: qrCode.From,
		Id:   qrCode.ID,
		Thid: qrCode.ThreadID,
		Typ:  string(qrCode.Typ),
		Type: string(qrCode.Type),
	}, nil
}

// GetConnection returns a connection with its related credentials
func (s *Server) GetConnection(ctx context.Context, request GetConnectionRequestObject) (GetConnectionResponseObject, error) {
	conn, err := s.connectionsService.GetByIDAndIssuerID(ctx, request.Id, s.cfg.APIUI.IssuerDID)
	if err != nil {
		if errors.Is(err, services.ErrConnectionDoesNotExist) {
			return GetConnection400JSONResponse{N400JSONResponse{"The given connection does not exist"}}, nil
		}
		log.Debug(ctx, "get connection internal server error", "err", err, "req", request)
		return GetConnection500JSONResponse{N500JSONResponse{"There was an error retrieving the connection"}}, nil
	}

	filter := &ports.ClaimsFilter{
		Subject: conn.UserDID.String(),
	}
	credentials, err := s.claimService.GetAll(ctx, s.cfg.APIUI.IssuerDID, filter)
	if err != nil && !errors.Is(err, services.ErrClaimNotFound) {
		log.Debug(ctx, "get connection internal server error retrieving credentials", "err", err, "req", request)
		return GetConnection500JSONResponse{N500JSONResponse{"There was an error retrieving the connection"}}, nil
	}

	w3credentials, err := schema.FromClaimsModelToW3CCredential(credentials)
	if err != nil {
		log.Debug(ctx, "get connection internal server error converting credentials to w3c", "err", err, "req", request)
		return GetConnection500JSONResponse{N500JSONResponse{"There was an error parsing the credential of the given connection"}}, nil
	}

	return GetConnection200JSONResponse(connectionResponse(conn, w3credentials, credentials)), nil
}

// GetConnections returns the list of credentials of a determined issuer
func (s *Server) GetConnections(ctx context.Context, request GetConnectionsRequestObject) (GetConnectionsResponseObject, error) {
	conns, err := s.connectionsService.GetAllByIssuerID(ctx, s.cfg.APIUI.IssuerDID, request.Params.Query)
	if err != nil {
		log.Error(ctx, "get connection request", err)
		return GetConnections500JSONResponse{N500JSONResponse{"Unexpected error while retrieving connections"}}, nil
	}

	return GetConnections200JSONResponse(connectionsResponse(conns)), nil
}

// DeleteConnection deletes a connection
func (s *Server) DeleteConnection(ctx context.Context, request DeleteConnectionRequestObject) (DeleteConnectionResponseObject, error) {
	err := s.connectionsService.Delete(ctx, request.Id, s.cfg.APIUI.IssuerDID)
	if err != nil {
		if errors.Is(err, services.ErrConnectionDoesNotExist) {
			return DeleteConnection400JSONResponse{N400JSONResponse{"The given connection does not exist"}}, nil
		}
		return DeleteConnection500JSONResponse{N500JSONResponse{"There was an error deleting the connection"}}, nil
	}

	return DeleteConnection200JSONResponse{Message: "Connection successfully deleted"}, nil
}

// DeleteConnectionCredentials deletes all the credentials of the given connection
func (s *Server) DeleteConnectionCredentials(ctx context.Context, request DeleteConnectionCredentialsRequestObject) (DeleteConnectionCredentialsResponseObject, error) {
	err := s.connectionsService.DeleteCredentials(ctx, request.Id, s.cfg.APIUI.IssuerDID)
	if err != nil {
		log.Error(ctx, "delete connection request", err, "req", request)
		return DeleteConnectionCredentials500JSONResponse{N500JSONResponse{"There was an error deleting the credentials of the given connection"}}, nil
	}

	return DeleteConnectionCredentials200JSONResponse{Message: "Credentials of the connection successfully deleted"}, nil
}

// GetCredential returns a credential
func (s *Server) GetCredential(ctx context.Context, request GetCredentialRequestObject) (GetCredentialResponseObject, error) {
	credential, err := s.claimService.GetByID(ctx, &s.cfg.APIUI.IssuerDID, request.Id)
	if err != nil {
		if errors.Is(err, services.ErrClaimNotFound) {
			return GetCredential400JSONResponse{N400JSONResponse{"The given credential id does not exist"}}, nil
		}
		return GetCredential500JSONResponse{N500JSONResponse{"There was an error trying to retrieve the credential information"}}, nil
	}

	w3c, err := schema.FromClaimModelToW3CCredential(*credential)
	if err != nil {
		return GetCredential500JSONResponse{N500JSONResponse{"Invalid claim format"}}, nil
	}

	return GetCredential200JSONResponse(credentialResponse(w3c, credential)), nil
}

// GetCredentials returns a collection of credentials that matches the request.
func (s *Server) GetCredentials(ctx context.Context, request GetCredentialsRequestObject) (GetCredentialsResponseObject, error) {
	filter := &ports.ClaimsFilter{}
	if request.Params.Type != nil {
		switch GetCredentialsParamsType(strings.ToLower(string(*request.Params.Type))) {
		case Revoked:
			filter.Revoked = common.ToPointer(true)
		case Expired:
			filter.ExpiredOn = common.ToPointer(time.Now())
		case All:
			// Nothing to be done
		default:
			return GetCredentials400JSONResponse{N400JSONResponse{Message: "Wrong type value. Allowed values: [all, revoked, expired]"}}, nil
		}
	}
	if request.Params.Query != nil {
		filter.FTSQuery = *request.Params.Query
	}
	credentials, err := s.claimService.GetAll(ctx, s.cfg.APIUI.IssuerDID, filter)
	if err != nil {
		log.Error(ctx, "loading credentials", "err", err, "req", request)
		return GetCredentials500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}
	response := make([]Credential, len(credentials))
	for i, credential := range credentials {
		w3c, err := schema.FromClaimModelToW3CCredential(*credential)
		if err != nil {
			log.Error(ctx, "creating credentials response", "err", err, "req", request)
			return GetCredentials500JSONResponse{N500JSONResponse{"Invalid claim format"}}, nil
		}
		response[i] = credentialResponse(w3c, credential)
	}
	return GetCredentials200JSONResponse(response), nil
}

// DeleteCredential deletes a credential
func (s *Server) DeleteCredential(ctx context.Context, request DeleteCredentialRequestObject) (DeleteCredentialResponseObject, error) {
	err := s.claimService.Delete(ctx, request.Id)
	if err != nil {
		if errors.Is(err, services.ErrClaimNotFound) {
			return DeleteCredential400JSONResponse{N400JSONResponse{"The given credential does not exist"}}, nil
		}
		return DeleteCredential500JSONResponse{N500JSONResponse{"There was an error deleting the credential"}}, nil
	}

	return DeleteCredential200JSONResponse{Message: "Credential successfully deleted"}, nil
}

// GetYaml this method will be overridden in the main function
func (s *Server) GetYaml(_ context.Context, _ GetYamlRequestObject) (GetYamlResponseObject, error) {
	return nil, nil
}

// CreateCredential - creates a new credential
func (s *Server) CreateCredential(ctx context.Context, request CreateCredentialRequestObject) (CreateCredentialResponseObject, error) {
	if request.Body.SignatureProof == nil && request.Body.MtProof == nil {
		return CreateCredential400JSONResponse{N400JSONResponse{Message: "you must to provide at least one proof type"}}, nil
	}

	req := ports.NewCreateClaimRequest(&s.cfg.APIUI.IssuerDID, request.Body.CredentialSchema, request.Body.CredentialSubject, request.Body.Expiration, request.Body.Type, nil, nil, nil, request.Body.SignatureProof, request.Body.MtProof)
	resp, err := s.claimService.CreateClaim(ctx, req)
	if err != nil {
		if errors.Is(err, services.ErrJSONLdContext) {
			return CreateCredential400JSONResponse{N400JSONResponse{Message: err.Error()}}, nil
		}
		if errors.Is(err, services.ErrProcessSchema) {
			return CreateCredential400JSONResponse{N400JSONResponse{Message: err.Error()}}, nil
		}
		if errors.Is(err, services.ErrLoadingSchema) {
			return CreateCredential422JSONResponse{N422JSONResponse{Message: err.Error()}}, nil
		}
		if errors.Is(err, services.ErrMalformedURL) {
			return CreateCredential400JSONResponse{N400JSONResponse{Message: err.Error()}}, nil
		}
		return CreateCredential500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}
	return CreateCredential201JSONResponse{Id: resp.ID.String()}, nil
}

// RevokeCredential - revokes a credential per a given nonce
func (s *Server) RevokeCredential(ctx context.Context, request RevokeCredentialRequestObject) (RevokeCredentialResponseObject, error) {
	if err := s.claimService.Revoke(ctx, s.cfg.APIUI.IssuerDID, uint64(request.Nonce), ""); err != nil {
		if errors.Is(err, repositories.ErrClaimDoesNotExist) {
			return RevokeCredential404JSONResponse{N404JSONResponse{
				Message: "the claim does not exist",
			}}, nil
		}
		log.Error(ctx, "revoke credential", "err", err, "req", request)
		return RevokeCredential500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}
	return RevokeCredential202JSONResponse{
		Message: "claim revocation request sent",
	}, nil
}

// PublishState - pubish the state onchange
func (s *Server) PublishState(ctx context.Context, request PublishStateRequestObject) (PublishStateResponseObject, error) {
	publishedState, err := s.publisherGateway.PublishState(ctx, &s.cfg.APIUI.IssuerDID)
	if err != nil {
		return PublishState500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
	}

	return PublishState202JSONResponse{
		ClaimsTreeRoot:     publishedState.ClaimsTreeRoot,
		RevocationTreeRoot: publishedState.RevocationTreeRoot,
		RootOfRoots:        publishedState.RootOfRoots,
		State:              publishedState.State,
		TxID:               publishedState.TxID,
	}, nil
}

// RevokeConnectionCredentials revoke all the non revoked credentials of the given connection
func (s *Server) RevokeConnectionCredentials(ctx context.Context, request RevokeConnectionCredentialsRequestObject) (RevokeConnectionCredentialsResponseObject, error) {
	err := s.claimService.RevokeAllFromConnection(ctx, request.Id, s.cfg.APIUI.IssuerDID)
	if err != nil {
		log.Error(ctx, "revoke connection credentials", "err", err, "req", request)
		return RevokeConnectionCredentials500JSONResponse{N500JSONResponse{"There was an error revoking the credentials of the given connection"}}, nil
	}

	return RevokeConnectionCredentials202JSONResponse{Message: "Credentials revocation request sent"}, nil
}

// CreateLink - creates a link for issuing a credential
func (s *Server) CreateLink(ctx context.Context, request CreateLinkRequestObject) (CreateLinkResponseObject, error) {
	if request.Body.ClaimLinkExpiration != nil {
		if isBeforeTomorrow(*request.Body.ClaimLinkExpiration) {
			return CreateLink400JSONResponse{N400JSONResponse{Message: "invalid claimLinkExpiration. Cannot be a date time prior current time."}}, nil
		}
	}
	if len(request.Body.Attributes) == 0 {
		return CreateLink400JSONResponse{N400JSONResponse{Message: "you must provide at least one attribute"}}, nil
	}

	attrs := make([]domain.CredentialAttributes, 0)
	for _, at := range request.Body.Attributes {
		attrs = append(attrs, domain.CredentialAttributes{
			Name:  at.Name,
			Value: at.Value,
		})
	}

	if request.Body.LimitedClaims != nil {
		if *request.Body.LimitedClaims <= 0 {
			return CreateLink400JSONResponse{N400JSONResponse{Message: "limitedClaims must be higher than 0"}}, nil
		}
	}

	var expirationDate *time.Time
	if request.Body.ExpirationDate != nil {
		expirationDate = common.ToPointer(request.Body.ExpirationDate.Time)
	}

	// Todo improve validations errors
	createdLink, err := s.linkService.Save(ctx, s.cfg.APIUI.IssuerDID, request.Body.LimitedClaims, request.Body.ClaimLinkExpiration, request.Body.SchemaID, expirationDate, request.Body.SignatureProof, request.Body.MtProof, attrs)
	if err != nil {
		log.Error(ctx, "error saving the link", err.Error())
		return CreateLink400JSONResponse{N400JSONResponse{Message: err.Error()}}, nil
	}
	return CreateLink201JSONResponse{Id: createdLink.ID.String()}, nil
}

// AcivateLink - Activates or deactivates a link
func (s *Server) AcivateLink(ctx context.Context, request AcivateLinkRequestObject) (AcivateLinkResponseObject, error) {
	err := s.linkService.Activate(ctx, request.Id, request.Body.Active)
	if err != nil {
		log.Error(ctx, "error activating or deactivating link", err.Error(), "id", request.Id)
		if errors.Is(err, repositories.ErrLinkDoesNotExist) || errors.Is(err, services.ErrLinkAlreadyActive) || errors.Is(err, services.ErrLinkAlreadyInactive) {
			return AcivateLink400JSONResponse{N400JSONResponse{Message: err.Error()}}, nil
		} else {
			return AcivateLink500JSONResponse{N500JSONResponse{Message: err.Error()}}, nil
		}
	}
	return AcivateLink200JSONResponse{Message: "Link updated"}, nil
}

func isBeforeTomorrow(t time.Time) bool {
	today := time.Now().UTC()
	tomorrow := time.Date(today.Year(), today.Month(), today.Day()+1, 0, 0, 0, 0, time.UTC)
	return t.Before(tomorrow)
}

// RegisterStatic add method to the mux that are not documented in the API.
func RegisterStatic(mux *chi.Mux) {
	mux.Get("/", documentation)
	mux.Get("/static/docs/api_ui/api.yaml", swagger)
}

func documentation(w http.ResponseWriter, _ *http.Request) {
	writeFile("api_ui/spec.html", w)
}

func swagger(w http.ResponseWriter, _ *http.Request) {
	writeFile("api_ui/api.yaml", w)
}

func writeFile(path string, w http.ResponseWriter) {
	f, err := os.ReadFile(path)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("not found"))
	}
	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(f)
}
