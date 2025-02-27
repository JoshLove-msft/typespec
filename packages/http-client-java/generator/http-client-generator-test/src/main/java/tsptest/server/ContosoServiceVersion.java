// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package tsptest.server;

import com.azure.core.util.ServiceVersion;

/**
 * Service version of ContosoClient.
 */
public enum ContosoServiceVersion implements ServiceVersion {
    /**
     * Enum value v1.
     */
    V1("v1");

    private final String version;

    ContosoServiceVersion(String version) {
        this.version = version;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getVersion() {
        return this.version;
    }

    /**
     * Gets the latest service version supported by this client library.
     * 
     * @return The latest {@link ContosoServiceVersion}.
     */
    public static ContosoServiceVersion getLatest() {
        return V1;
    }
}
