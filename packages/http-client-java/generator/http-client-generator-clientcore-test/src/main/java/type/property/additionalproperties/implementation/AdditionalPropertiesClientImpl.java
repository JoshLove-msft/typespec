package type.property.additionalproperties.implementation;

import io.clientcore.core.http.pipeline.HttpPipeline;
import io.clientcore.core.instrumentation.Instrumentation;

/**
 * Initializes a new instance of the AdditionalPropertiesClient type.
 */
public final class AdditionalPropertiesClientImpl {
    /**
     * Service host.
     */
    private final String endpoint;

    /**
     * Gets Service host.
     * 
     * @return the endpoint value.
     */
    public String getEndpoint() {
        return this.endpoint;
    }

    /**
     * The HTTP pipeline to send requests through.
     */
    private final HttpPipeline httpPipeline;

    /**
     * Gets The HTTP pipeline to send requests through.
     * 
     * @return the httpPipeline value.
     */
    public HttpPipeline getHttpPipeline() {
        return this.httpPipeline;
    }

    /**
     * The instance of instrumentation to report telemetry.
     */
    private final Instrumentation instrumentation;

    /**
     * Gets The instance of instrumentation to report telemetry.
     * 
     * @return the instrumentation value.
     */
    public Instrumentation getInstrumentation() {
        return this.instrumentation;
    }

    /**
     * The ExtendsUnknownsImpl object to access its operations.
     */
    private final ExtendsUnknownsImpl extendsUnknowns;

    /**
     * Gets the ExtendsUnknownsImpl object to access its operations.
     * 
     * @return the ExtendsUnknownsImpl object.
     */
    public ExtendsUnknownsImpl getExtendsUnknowns() {
        return this.extendsUnknowns;
    }

    /**
     * The ExtendsUnknownDerivedsImpl object to access its operations.
     */
    private final ExtendsUnknownDerivedsImpl extendsUnknownDeriveds;

    /**
     * Gets the ExtendsUnknownDerivedsImpl object to access its operations.
     * 
     * @return the ExtendsUnknownDerivedsImpl object.
     */
    public ExtendsUnknownDerivedsImpl getExtendsUnknownDeriveds() {
        return this.extendsUnknownDeriveds;
    }

    /**
     * The ExtendsUnknownDiscriminatedsImpl object to access its operations.
     */
    private final ExtendsUnknownDiscriminatedsImpl extendsUnknownDiscriminateds;

    /**
     * Gets the ExtendsUnknownDiscriminatedsImpl object to access its operations.
     * 
     * @return the ExtendsUnknownDiscriminatedsImpl object.
     */
    public ExtendsUnknownDiscriminatedsImpl getExtendsUnknownDiscriminateds() {
        return this.extendsUnknownDiscriminateds;
    }

    /**
     * The IsUnknownsImpl object to access its operations.
     */
    private final IsUnknownsImpl isUnknowns;

    /**
     * Gets the IsUnknownsImpl object to access its operations.
     * 
     * @return the IsUnknownsImpl object.
     */
    public IsUnknownsImpl getIsUnknowns() {
        return this.isUnknowns;
    }

    /**
     * The IsUnknownDerivedsImpl object to access its operations.
     */
    private final IsUnknownDerivedsImpl isUnknownDeriveds;

    /**
     * Gets the IsUnknownDerivedsImpl object to access its operations.
     * 
     * @return the IsUnknownDerivedsImpl object.
     */
    public IsUnknownDerivedsImpl getIsUnknownDeriveds() {
        return this.isUnknownDeriveds;
    }

    /**
     * The IsUnknownDiscriminatedsImpl object to access its operations.
     */
    private final IsUnknownDiscriminatedsImpl isUnknownDiscriminateds;

    /**
     * Gets the IsUnknownDiscriminatedsImpl object to access its operations.
     * 
     * @return the IsUnknownDiscriminatedsImpl object.
     */
    public IsUnknownDiscriminatedsImpl getIsUnknownDiscriminateds() {
        return this.isUnknownDiscriminateds;
    }

    /**
     * The ExtendsStringsImpl object to access its operations.
     */
    private final ExtendsStringsImpl extendsStrings;

    /**
     * Gets the ExtendsStringsImpl object to access its operations.
     * 
     * @return the ExtendsStringsImpl object.
     */
    public ExtendsStringsImpl getExtendsStrings() {
        return this.extendsStrings;
    }

    /**
     * The IsStringsImpl object to access its operations.
     */
    private final IsStringsImpl isStrings;

    /**
     * Gets the IsStringsImpl object to access its operations.
     * 
     * @return the IsStringsImpl object.
     */
    public IsStringsImpl getIsStrings() {
        return this.isStrings;
    }

    /**
     * The SpreadStringsImpl object to access its operations.
     */
    private final SpreadStringsImpl spreadStrings;

    /**
     * Gets the SpreadStringsImpl object to access its operations.
     * 
     * @return the SpreadStringsImpl object.
     */
    public SpreadStringsImpl getSpreadStrings() {
        return this.spreadStrings;
    }

    /**
     * The ExtendsFloatsImpl object to access its operations.
     */
    private final ExtendsFloatsImpl extendsFloats;

    /**
     * Gets the ExtendsFloatsImpl object to access its operations.
     * 
     * @return the ExtendsFloatsImpl object.
     */
    public ExtendsFloatsImpl getExtendsFloats() {
        return this.extendsFloats;
    }

    /**
     * The IsFloatsImpl object to access its operations.
     */
    private final IsFloatsImpl isFloats;

    /**
     * Gets the IsFloatsImpl object to access its operations.
     * 
     * @return the IsFloatsImpl object.
     */
    public IsFloatsImpl getIsFloats() {
        return this.isFloats;
    }

    /**
     * The SpreadFloatsImpl object to access its operations.
     */
    private final SpreadFloatsImpl spreadFloats;

    /**
     * Gets the SpreadFloatsImpl object to access its operations.
     * 
     * @return the SpreadFloatsImpl object.
     */
    public SpreadFloatsImpl getSpreadFloats() {
        return this.spreadFloats;
    }

    /**
     * The ExtendsModelsImpl object to access its operations.
     */
    private final ExtendsModelsImpl extendsModels;

    /**
     * Gets the ExtendsModelsImpl object to access its operations.
     * 
     * @return the ExtendsModelsImpl object.
     */
    public ExtendsModelsImpl getExtendsModels() {
        return this.extendsModels;
    }

    /**
     * The IsModelsImpl object to access its operations.
     */
    private final IsModelsImpl isModels;

    /**
     * Gets the IsModelsImpl object to access its operations.
     * 
     * @return the IsModelsImpl object.
     */
    public IsModelsImpl getIsModels() {
        return this.isModels;
    }

    /**
     * The SpreadModelsImpl object to access its operations.
     */
    private final SpreadModelsImpl spreadModels;

    /**
     * Gets the SpreadModelsImpl object to access its operations.
     * 
     * @return the SpreadModelsImpl object.
     */
    public SpreadModelsImpl getSpreadModels() {
        return this.spreadModels;
    }

    /**
     * The ExtendsModelArraysImpl object to access its operations.
     */
    private final ExtendsModelArraysImpl extendsModelArrays;

    /**
     * Gets the ExtendsModelArraysImpl object to access its operations.
     * 
     * @return the ExtendsModelArraysImpl object.
     */
    public ExtendsModelArraysImpl getExtendsModelArrays() {
        return this.extendsModelArrays;
    }

    /**
     * The IsModelArraysImpl object to access its operations.
     */
    private final IsModelArraysImpl isModelArrays;

    /**
     * Gets the IsModelArraysImpl object to access its operations.
     * 
     * @return the IsModelArraysImpl object.
     */
    public IsModelArraysImpl getIsModelArrays() {
        return this.isModelArrays;
    }

    /**
     * The SpreadModelArraysImpl object to access its operations.
     */
    private final SpreadModelArraysImpl spreadModelArrays;

    /**
     * Gets the SpreadModelArraysImpl object to access its operations.
     * 
     * @return the SpreadModelArraysImpl object.
     */
    public SpreadModelArraysImpl getSpreadModelArrays() {
        return this.spreadModelArrays;
    }

    /**
     * The SpreadDifferentStringsImpl object to access its operations.
     */
    private final SpreadDifferentStringsImpl spreadDifferentStrings;

    /**
     * Gets the SpreadDifferentStringsImpl object to access its operations.
     * 
     * @return the SpreadDifferentStringsImpl object.
     */
    public SpreadDifferentStringsImpl getSpreadDifferentStrings() {
        return this.spreadDifferentStrings;
    }

    /**
     * The SpreadDifferentFloatsImpl object to access its operations.
     */
    private final SpreadDifferentFloatsImpl spreadDifferentFloats;

    /**
     * Gets the SpreadDifferentFloatsImpl object to access its operations.
     * 
     * @return the SpreadDifferentFloatsImpl object.
     */
    public SpreadDifferentFloatsImpl getSpreadDifferentFloats() {
        return this.spreadDifferentFloats;
    }

    /**
     * The SpreadDifferentModelsImpl object to access its operations.
     */
    private final SpreadDifferentModelsImpl spreadDifferentModels;

    /**
     * Gets the SpreadDifferentModelsImpl object to access its operations.
     * 
     * @return the SpreadDifferentModelsImpl object.
     */
    public SpreadDifferentModelsImpl getSpreadDifferentModels() {
        return this.spreadDifferentModels;
    }

    /**
     * The SpreadDifferentModelArraysImpl object to access its operations.
     */
    private final SpreadDifferentModelArraysImpl spreadDifferentModelArrays;

    /**
     * Gets the SpreadDifferentModelArraysImpl object to access its operations.
     * 
     * @return the SpreadDifferentModelArraysImpl object.
     */
    public SpreadDifferentModelArraysImpl getSpreadDifferentModelArrays() {
        return this.spreadDifferentModelArrays;
    }

    /**
     * The ExtendsDifferentSpreadStringsImpl object to access its operations.
     */
    private final ExtendsDifferentSpreadStringsImpl extendsDifferentSpreadStrings;

    /**
     * Gets the ExtendsDifferentSpreadStringsImpl object to access its operations.
     * 
     * @return the ExtendsDifferentSpreadStringsImpl object.
     */
    public ExtendsDifferentSpreadStringsImpl getExtendsDifferentSpreadStrings() {
        return this.extendsDifferentSpreadStrings;
    }

    /**
     * The ExtendsDifferentSpreadFloatsImpl object to access its operations.
     */
    private final ExtendsDifferentSpreadFloatsImpl extendsDifferentSpreadFloats;

    /**
     * Gets the ExtendsDifferentSpreadFloatsImpl object to access its operations.
     * 
     * @return the ExtendsDifferentSpreadFloatsImpl object.
     */
    public ExtendsDifferentSpreadFloatsImpl getExtendsDifferentSpreadFloats() {
        return this.extendsDifferentSpreadFloats;
    }

    /**
     * The ExtendsDifferentSpreadModelsImpl object to access its operations.
     */
    private final ExtendsDifferentSpreadModelsImpl extendsDifferentSpreadModels;

    /**
     * Gets the ExtendsDifferentSpreadModelsImpl object to access its operations.
     * 
     * @return the ExtendsDifferentSpreadModelsImpl object.
     */
    public ExtendsDifferentSpreadModelsImpl getExtendsDifferentSpreadModels() {
        return this.extendsDifferentSpreadModels;
    }

    /**
     * The ExtendsDifferentSpreadModelArraysImpl object to access its operations.
     */
    private final ExtendsDifferentSpreadModelArraysImpl extendsDifferentSpreadModelArrays;

    /**
     * Gets the ExtendsDifferentSpreadModelArraysImpl object to access its operations.
     * 
     * @return the ExtendsDifferentSpreadModelArraysImpl object.
     */
    public ExtendsDifferentSpreadModelArraysImpl getExtendsDifferentSpreadModelArrays() {
        return this.extendsDifferentSpreadModelArrays;
    }

    /**
     * The MultipleSpreadsImpl object to access its operations.
     */
    private final MultipleSpreadsImpl multipleSpreads;

    /**
     * Gets the MultipleSpreadsImpl object to access its operations.
     * 
     * @return the MultipleSpreadsImpl object.
     */
    public MultipleSpreadsImpl getMultipleSpreads() {
        return this.multipleSpreads;
    }

    /**
     * The SpreadRecordUnionsImpl object to access its operations.
     */
    private final SpreadRecordUnionsImpl spreadRecordUnions;

    /**
     * Gets the SpreadRecordUnionsImpl object to access its operations.
     * 
     * @return the SpreadRecordUnionsImpl object.
     */
    public SpreadRecordUnionsImpl getSpreadRecordUnions() {
        return this.spreadRecordUnions;
    }

    /**
     * The SpreadRecordNonDiscriminatedUnionsImpl object to access its operations.
     */
    private final SpreadRecordNonDiscriminatedUnionsImpl spreadRecordNonDiscriminatedUnions;

    /**
     * Gets the SpreadRecordNonDiscriminatedUnionsImpl object to access its operations.
     * 
     * @return the SpreadRecordNonDiscriminatedUnionsImpl object.
     */
    public SpreadRecordNonDiscriminatedUnionsImpl getSpreadRecordNonDiscriminatedUnions() {
        return this.spreadRecordNonDiscriminatedUnions;
    }

    /**
     * The SpreadRecordNonDiscriminatedUnion2sImpl object to access its operations.
     */
    private final SpreadRecordNonDiscriminatedUnion2sImpl spreadRecordNonDiscriminatedUnion2s;

    /**
     * Gets the SpreadRecordNonDiscriminatedUnion2sImpl object to access its operations.
     * 
     * @return the SpreadRecordNonDiscriminatedUnion2sImpl object.
     */
    public SpreadRecordNonDiscriminatedUnion2sImpl getSpreadRecordNonDiscriminatedUnion2s() {
        return this.spreadRecordNonDiscriminatedUnion2s;
    }

    /**
     * The SpreadRecordNonDiscriminatedUnion3sImpl object to access its operations.
     */
    private final SpreadRecordNonDiscriminatedUnion3sImpl spreadRecordNonDiscriminatedUnion3s;

    /**
     * Gets the SpreadRecordNonDiscriminatedUnion3sImpl object to access its operations.
     * 
     * @return the SpreadRecordNonDiscriminatedUnion3sImpl object.
     */
    public SpreadRecordNonDiscriminatedUnion3sImpl getSpreadRecordNonDiscriminatedUnion3s() {
        return this.spreadRecordNonDiscriminatedUnion3s;
    }

    /**
     * Initializes an instance of AdditionalPropertiesClient client.
     * 
     * @param httpPipeline The HTTP pipeline to send requests through.
     * @param instrumentation The instance of instrumentation to report telemetry.
     * @param endpoint Service host.
     */
    public AdditionalPropertiesClientImpl(HttpPipeline httpPipeline, Instrumentation instrumentation, String endpoint) {
        this.httpPipeline = httpPipeline;
        this.instrumentation = instrumentation;
        this.endpoint = endpoint;
        this.extendsUnknowns = new ExtendsUnknownsImpl(this);
        this.extendsUnknownDeriveds = new ExtendsUnknownDerivedsImpl(this);
        this.extendsUnknownDiscriminateds = new ExtendsUnknownDiscriminatedsImpl(this);
        this.isUnknowns = new IsUnknownsImpl(this);
        this.isUnknownDeriveds = new IsUnknownDerivedsImpl(this);
        this.isUnknownDiscriminateds = new IsUnknownDiscriminatedsImpl(this);
        this.extendsStrings = new ExtendsStringsImpl(this);
        this.isStrings = new IsStringsImpl(this);
        this.spreadStrings = new SpreadStringsImpl(this);
        this.extendsFloats = new ExtendsFloatsImpl(this);
        this.isFloats = new IsFloatsImpl(this);
        this.spreadFloats = new SpreadFloatsImpl(this);
        this.extendsModels = new ExtendsModelsImpl(this);
        this.isModels = new IsModelsImpl(this);
        this.spreadModels = new SpreadModelsImpl(this);
        this.extendsModelArrays = new ExtendsModelArraysImpl(this);
        this.isModelArrays = new IsModelArraysImpl(this);
        this.spreadModelArrays = new SpreadModelArraysImpl(this);
        this.spreadDifferentStrings = new SpreadDifferentStringsImpl(this);
        this.spreadDifferentFloats = new SpreadDifferentFloatsImpl(this);
        this.spreadDifferentModels = new SpreadDifferentModelsImpl(this);
        this.spreadDifferentModelArrays = new SpreadDifferentModelArraysImpl(this);
        this.extendsDifferentSpreadStrings = new ExtendsDifferentSpreadStringsImpl(this);
        this.extendsDifferentSpreadFloats = new ExtendsDifferentSpreadFloatsImpl(this);
        this.extendsDifferentSpreadModels = new ExtendsDifferentSpreadModelsImpl(this);
        this.extendsDifferentSpreadModelArrays = new ExtendsDifferentSpreadModelArraysImpl(this);
        this.multipleSpreads = new MultipleSpreadsImpl(this);
        this.spreadRecordUnions = new SpreadRecordUnionsImpl(this);
        this.spreadRecordNonDiscriminatedUnions = new SpreadRecordNonDiscriminatedUnionsImpl(this);
        this.spreadRecordNonDiscriminatedUnion2s = new SpreadRecordNonDiscriminatedUnion2sImpl(this);
        this.spreadRecordNonDiscriminatedUnion3s = new SpreadRecordNonDiscriminatedUnion3sImpl(this);
    }
}
