// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package tsptest.armresourceprovider;

import com.azure.core.credential.TokenCredential;
import com.azure.core.http.HttpClient;
import com.azure.core.http.HttpPipeline;
import com.azure.core.http.HttpPipelineBuilder;
import com.azure.core.http.HttpPipelinePosition;
import com.azure.core.http.policy.AddDatePolicy;
import com.azure.core.http.policy.AddHeadersFromContextPolicy;
import com.azure.core.http.policy.BearerTokenAuthenticationPolicy;
import com.azure.core.http.policy.HttpLogOptions;
import com.azure.core.http.policy.HttpLoggingPolicy;
import com.azure.core.http.policy.HttpPipelinePolicy;
import com.azure.core.http.policy.HttpPolicyProviders;
import com.azure.core.http.policy.RequestIdPolicy;
import com.azure.core.http.policy.RetryOptions;
import com.azure.core.http.policy.RetryPolicy;
import com.azure.core.http.policy.UserAgentPolicy;
import com.azure.core.management.profile.AzureProfile;
import com.azure.core.util.Configuration;
import com.azure.core.util.CoreUtils;
import com.azure.core.util.logging.ClientLogger;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import tsptest.armresourceprovider.fluent.ArmClient;
import tsptest.armresourceprovider.implementation.ArmClientBuilder;
import tsptest.armresourceprovider.implementation.ChildExtensionResourceInterfacesImpl;
import tsptest.armresourceprovider.implementation.ChildResourcesInterfacesImpl;
import tsptest.armresourceprovider.implementation.CustomTemplateResourceInterfacesImpl;
import tsptest.armresourceprovider.implementation.ImmutableResourceModelsImpl;
import tsptest.armresourceprovider.implementation.ManagedMaintenanceWindowStatusOperationsImpl;
import tsptest.armresourceprovider.implementation.ModelInterfaceSameNamesImpl;
import tsptest.armresourceprovider.implementation.OperationsImpl;
import tsptest.armresourceprovider.implementation.TopLevelArmResourceInterfacesImpl;
import tsptest.armresourceprovider.models.ChildExtensionResourceInterfaces;
import tsptest.armresourceprovider.models.ChildResourcesInterfaces;
import tsptest.armresourceprovider.models.CustomTemplateResourceInterfaces;
import tsptest.armresourceprovider.models.ImmutableResourceModels;
import tsptest.armresourceprovider.models.ManagedMaintenanceWindowStatusOperations;
import tsptest.armresourceprovider.models.ModelInterfaceSameNames;
import tsptest.armresourceprovider.models.Operations;
import tsptest.armresourceprovider.models.TopLevelArmResourceInterfaces;

/**
 * Entry point to ArmResourceProviderManager.
 * Arm Resource Provider management API.
 */
public final class ArmResourceProviderManager {
    private ChildResourcesInterfaces childResourcesInterfaces;

    private TopLevelArmResourceInterfaces topLevelArmResourceInterfaces;

    private CustomTemplateResourceInterfaces customTemplateResourceInterfaces;

    private Operations operations;

    private ChildExtensionResourceInterfaces childExtensionResourceInterfaces;

    private ManagedMaintenanceWindowStatusOperations managedMaintenanceWindowStatusOperations;

    private ModelInterfaceSameNames modelInterfaceSameNames;

    private ImmutableResourceModels immutableResourceModels;

    private final ArmClient clientObject;

    private ArmResourceProviderManager(HttpPipeline httpPipeline, AzureProfile profile, Duration defaultPollInterval) {
        Objects.requireNonNull(httpPipeline, "'httpPipeline' cannot be null.");
        Objects.requireNonNull(profile, "'profile' cannot be null.");
        this.clientObject = new ArmClientBuilder().pipeline(httpPipeline)
            .endpoint(profile.getEnvironment().getResourceManagerEndpoint())
            .subscriptionId(profile.getSubscriptionId())
            .defaultPollInterval(defaultPollInterval)
            .buildClient();
    }

    /**
     * Creates an instance of Arm Resource Provider service API entry point.
     * 
     * @param credential the credential to use.
     * @param profile the Azure profile for client.
     * @return the Arm Resource Provider service API instance.
     */
    public static ArmResourceProviderManager authenticate(TokenCredential credential, AzureProfile profile) {
        Objects.requireNonNull(credential, "'credential' cannot be null.");
        Objects.requireNonNull(profile, "'profile' cannot be null.");
        return configure().authenticate(credential, profile);
    }

    /**
     * Creates an instance of Arm Resource Provider service API entry point.
     * 
     * @param httpPipeline the {@link HttpPipeline} configured with Azure authentication credential.
     * @param profile the Azure profile for client.
     * @return the Arm Resource Provider service API instance.
     */
    public static ArmResourceProviderManager authenticate(HttpPipeline httpPipeline, AzureProfile profile) {
        Objects.requireNonNull(httpPipeline, "'httpPipeline' cannot be null.");
        Objects.requireNonNull(profile, "'profile' cannot be null.");
        return new ArmResourceProviderManager(httpPipeline, profile, null);
    }

    /**
     * Gets a Configurable instance that can be used to create ArmResourceProviderManager with optional configuration.
     * 
     * @return the Configurable instance allowing configurations.
     */
    public static Configurable configure() {
        return new ArmResourceProviderManager.Configurable();
    }

    /**
     * The Configurable allowing configurations to be set.
     */
    public static final class Configurable {
        private static final ClientLogger LOGGER = new ClientLogger(Configurable.class);
        private static final String SDK_VERSION = "version";
        private static final Map<String, String> PROPERTIES
            = CoreUtils.getProperties("azure-resourcemanager-armresourceprovider-generated.properties");

        private HttpClient httpClient;
        private HttpLogOptions httpLogOptions;
        private final List<HttpPipelinePolicy> policies = new ArrayList<>();
        private final List<String> scopes = new ArrayList<>();
        private RetryPolicy retryPolicy;
        private RetryOptions retryOptions;
        private Duration defaultPollInterval;

        private Configurable() {
        }

        /**
         * Sets the http client.
         *
         * @param httpClient the HTTP client.
         * @return the configurable object itself.
         */
        public Configurable withHttpClient(HttpClient httpClient) {
            this.httpClient = Objects.requireNonNull(httpClient, "'httpClient' cannot be null.");
            return this;
        }

        /**
         * Sets the logging options to the HTTP pipeline.
         *
         * @param httpLogOptions the HTTP log options.
         * @return the configurable object itself.
         */
        public Configurable withLogOptions(HttpLogOptions httpLogOptions) {
            this.httpLogOptions = Objects.requireNonNull(httpLogOptions, "'httpLogOptions' cannot be null.");
            return this;
        }

        /**
         * Adds the pipeline policy to the HTTP pipeline.
         *
         * @param policy the HTTP pipeline policy.
         * @return the configurable object itself.
         */
        public Configurable withPolicy(HttpPipelinePolicy policy) {
            this.policies.add(Objects.requireNonNull(policy, "'policy' cannot be null."));
            return this;
        }

        /**
         * Adds the scope to permission sets.
         *
         * @param scope the scope.
         * @return the configurable object itself.
         */
        public Configurable withScope(String scope) {
            this.scopes.add(Objects.requireNonNull(scope, "'scope' cannot be null."));
            return this;
        }

        /**
         * Sets the retry policy to the HTTP pipeline.
         *
         * @param retryPolicy the HTTP pipeline retry policy.
         * @return the configurable object itself.
         */
        public Configurable withRetryPolicy(RetryPolicy retryPolicy) {
            this.retryPolicy = Objects.requireNonNull(retryPolicy, "'retryPolicy' cannot be null.");
            return this;
        }

        /**
         * Sets the retry options for the HTTP pipeline retry policy.
         * <p>
         * This setting has no effect, if retry policy is set via {@link #withRetryPolicy(RetryPolicy)}.
         *
         * @param retryOptions the retry options for the HTTP pipeline retry policy.
         * @return the configurable object itself.
         */
        public Configurable withRetryOptions(RetryOptions retryOptions) {
            this.retryOptions = Objects.requireNonNull(retryOptions, "'retryOptions' cannot be null.");
            return this;
        }

        /**
         * Sets the default poll interval, used when service does not provide "Retry-After" header.
         *
         * @param defaultPollInterval the default poll interval.
         * @return the configurable object itself.
         */
        public Configurable withDefaultPollInterval(Duration defaultPollInterval) {
            this.defaultPollInterval
                = Objects.requireNonNull(defaultPollInterval, "'defaultPollInterval' cannot be null.");
            if (this.defaultPollInterval.isNegative()) {
                throw LOGGER
                    .logExceptionAsError(new IllegalArgumentException("'defaultPollInterval' cannot be negative"));
            }
            return this;
        }

        /**
         * Creates an instance of Arm Resource Provider service API entry point.
         *
         * @param credential the credential to use.
         * @param profile the Azure profile for client.
         * @return the Arm Resource Provider service API instance.
         */
        public ArmResourceProviderManager authenticate(TokenCredential credential, AzureProfile profile) {
            Objects.requireNonNull(credential, "'credential' cannot be null.");
            Objects.requireNonNull(profile, "'profile' cannot be null.");

            String clientVersion = PROPERTIES.getOrDefault(SDK_VERSION, "UnknownVersion");

            StringBuilder userAgentBuilder = new StringBuilder();
            userAgentBuilder.append("azsdk-java")
                .append("-")
                .append("tsptest.armresourceprovider")
                .append("/")
                .append(clientVersion);
            if (!Configuration.getGlobalConfiguration().get("AZURE_TELEMETRY_DISABLED", false)) {
                userAgentBuilder.append(" (")
                    .append(Configuration.getGlobalConfiguration().get("java.version"))
                    .append("; ")
                    .append(Configuration.getGlobalConfiguration().get("os.name"))
                    .append("; ")
                    .append(Configuration.getGlobalConfiguration().get("os.version"))
                    .append("; auto-generated)");
            } else {
                userAgentBuilder.append(" (auto-generated)");
            }

            if (scopes.isEmpty()) {
                scopes.add(profile.getEnvironment().getManagementEndpoint() + "/.default");
            }
            if (retryPolicy == null) {
                if (retryOptions != null) {
                    retryPolicy = new RetryPolicy(retryOptions);
                } else {
                    retryPolicy = new RetryPolicy("Retry-After", ChronoUnit.SECONDS);
                }
            }
            List<HttpPipelinePolicy> policies = new ArrayList<>();
            policies.add(new UserAgentPolicy(userAgentBuilder.toString()));
            policies.add(new AddHeadersFromContextPolicy());
            policies.add(new RequestIdPolicy());
            policies.addAll(this.policies.stream()
                .filter(p -> p.getPipelinePosition() == HttpPipelinePosition.PER_CALL)
                .collect(Collectors.toList()));
            HttpPolicyProviders.addBeforeRetryPolicies(policies);
            policies.add(retryPolicy);
            policies.add(new AddDatePolicy());
            policies.add(new BearerTokenAuthenticationPolicy(credential, scopes.toArray(new String[0])));
            policies.addAll(this.policies.stream()
                .filter(p -> p.getPipelinePosition() == HttpPipelinePosition.PER_RETRY)
                .collect(Collectors.toList()));
            HttpPolicyProviders.addAfterRetryPolicies(policies);
            policies.add(new HttpLoggingPolicy(httpLogOptions));
            HttpPipeline httpPipeline = new HttpPipelineBuilder().httpClient(httpClient)
                .policies(policies.toArray(new HttpPipelinePolicy[0]))
                .build();
            return new ArmResourceProviderManager(httpPipeline, profile, defaultPollInterval);
        }
    }

    /**
     * Gets the resource collection API of ChildResourcesInterfaces. It manages ChildResource.
     * 
     * @return Resource collection API of ChildResourcesInterfaces.
     */
    public ChildResourcesInterfaces childResourcesInterfaces() {
        if (this.childResourcesInterfaces == null) {
            this.childResourcesInterfaces
                = new ChildResourcesInterfacesImpl(clientObject.getChildResourcesInterfaces(), this);
        }
        return childResourcesInterfaces;
    }

    /**
     * Gets the resource collection API of TopLevelArmResourceInterfaces. It manages TopLevelArmResource.
     * 
     * @return Resource collection API of TopLevelArmResourceInterfaces.
     */
    public TopLevelArmResourceInterfaces topLevelArmResourceInterfaces() {
        if (this.topLevelArmResourceInterfaces == null) {
            this.topLevelArmResourceInterfaces
                = new TopLevelArmResourceInterfacesImpl(clientObject.getTopLevelArmResourceInterfaces(), this);
        }
        return topLevelArmResourceInterfaces;
    }

    /**
     * Gets the resource collection API of CustomTemplateResourceInterfaces. It manages CustomTemplateResource.
     * 
     * @return Resource collection API of CustomTemplateResourceInterfaces.
     */
    public CustomTemplateResourceInterfaces customTemplateResourceInterfaces() {
        if (this.customTemplateResourceInterfaces == null) {
            this.customTemplateResourceInterfaces
                = new CustomTemplateResourceInterfacesImpl(clientObject.getCustomTemplateResourceInterfaces(), this);
        }
        return customTemplateResourceInterfaces;
    }

    /**
     * Gets the resource collection API of Operations.
     * 
     * @return Resource collection API of Operations.
     */
    public Operations operations() {
        if (this.operations == null) {
            this.operations = new OperationsImpl(clientObject.getOperations(), this);
        }
        return operations;
    }

    /**
     * Gets the resource collection API of ChildExtensionResourceInterfaces. It manages ChildExtensionResource.
     * 
     * @return Resource collection API of ChildExtensionResourceInterfaces.
     */
    public ChildExtensionResourceInterfaces childExtensionResourceInterfaces() {
        if (this.childExtensionResourceInterfaces == null) {
            this.childExtensionResourceInterfaces
                = new ChildExtensionResourceInterfacesImpl(clientObject.getChildExtensionResourceInterfaces(), this);
        }
        return childExtensionResourceInterfaces;
    }

    /**
     * Gets the resource collection API of ManagedMaintenanceWindowStatusOperations.
     * 
     * @return Resource collection API of ManagedMaintenanceWindowStatusOperations.
     */
    public ManagedMaintenanceWindowStatusOperations managedMaintenanceWindowStatusOperations() {
        if (this.managedMaintenanceWindowStatusOperations == null) {
            this.managedMaintenanceWindowStatusOperations = new ManagedMaintenanceWindowStatusOperationsImpl(
                clientObject.getManagedMaintenanceWindowStatusOperations(), this);
        }
        return managedMaintenanceWindowStatusOperations;
    }

    /**
     * Gets the resource collection API of ModelInterfaceSameNames.
     * 
     * @return Resource collection API of ModelInterfaceSameNames.
     */
    public ModelInterfaceSameNames modelInterfaceSameNames() {
        if (this.modelInterfaceSameNames == null) {
            this.modelInterfaceSameNames
                = new ModelInterfaceSameNamesImpl(clientObject.getModelInterfaceSameNames(), this);
        }
        return modelInterfaceSameNames;
    }

    /**
     * Gets the resource collection API of ImmutableResourceModels.
     * 
     * @return Resource collection API of ImmutableResourceModels.
     */
    public ImmutableResourceModels immutableResourceModels() {
        if (this.immutableResourceModels == null) {
            this.immutableResourceModels
                = new ImmutableResourceModelsImpl(clientObject.getImmutableResourceModels(), this);
        }
        return immutableResourceModels;
    }

    /**
     * Gets wrapped service client ArmClient providing direct access to the underlying auto-generated API
     * implementation, based on Azure REST API.
     * 
     * @return Wrapped service client ArmClient.
     */
    public ArmClient serviceClient() {
        return this.clientObject;
    }
}
