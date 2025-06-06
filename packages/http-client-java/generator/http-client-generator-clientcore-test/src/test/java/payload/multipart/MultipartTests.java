// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package payload.multipart;

import io.clientcore.core.http.models.HttpRequest;
import io.clientcore.core.http.models.Response;
import io.clientcore.core.http.pipeline.HttpPipelineNextPolicy;
import io.clientcore.core.http.pipeline.HttpPipelinePolicy;
import io.clientcore.core.models.binarydata.BinaryData;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.utils.FileUtils;
import payload.multipart.formdata.AnonymousModelRequest;
import payload.multipart.formdata.httpparts.nonstring.FloatRequest;

@Disabled
public class MultipartTests {

    private final MultipartFilenameValidationPolicy validationPolicy = new MultipartFilenameValidationPolicy();

    private final FormDataClient client
        = new MultiPartClientBuilder().addHttpPipelinePolicy(validationPolicy).buildFormDataClient();

    private final FormDataHttpPartsContentTypeClient httpPartContentTypeClient
        = new MultiPartClientBuilder().addHttpPipelinePolicy(validationPolicy)
            .buildFormDataHttpPartsContentTypeClient();

    private static final Path FILE = FileUtils.getJpgFile();

    private static final Path PNG_FILE = FileUtils.getPngFile();

    private static final String FILENAME = "image";
    private static final String FILE_CONTENT_TYPE = "application/octet-stream";

    private final static class KpmAlgorithm {
        private static int indexOf(byte[] data, int start, int stop, byte[] pattern) {
            if (data == null || pattern == null)
                return -1;

            int[] failure = computeFailure(pattern);

            int j = 0;

            for (int i = start; i < stop; i++) {
                while (j > 0 && (pattern[j] != '*' && pattern[j] != data[i])) {
                    j = failure[j - 1];
                }
                if (pattern[j] == '*' || pattern[j] == data[i]) {
                    j++;
                }
                if (j == pattern.length) {
                    return i - pattern.length + 1;
                }
            }
            return -1;
        }

        private static int[] computeFailure(byte[] pattern) {
            int[] failure = new int[pattern.length];

            int j = 0;
            for (int i = 1; i < pattern.length; i++) {
                while (j > 0 && pattern[j] != pattern[i]) {
                    j = failure[j - 1];
                }
                if (pattern[j] == pattern[i]) {
                    j++;
                }
                failure[i] = j;
            }

            return failure;
        }
    }

    private final static class MultipartFilenameValidationPolicy implements HttpPipelinePolicy {
        private final List<String> filenames = new ArrayList<>();
        private final List<String> contentTypes = new ArrayList<>();

        private final static Pattern FILENAME_PATTERN = Pattern.compile("filename=\"(.*?)\"");
        private final static Pattern CONTENT_TYPE_PATTERN = Pattern.compile("Content-Type:\\s*(.*)");

        @Override
        public Response process(HttpRequest request, HttpPipelineNextPolicy nextPolicy) {
            filenames.clear();
            byte[] body = request.getBody().toBytes();
            int start = 0;
            int stop = body.length;
            byte[] pattern = "Content-Disposition:".getBytes(StandardCharsets.UTF_8);

            int index;
            while ((index = KpmAlgorithm.indexOf(body, start, stop, pattern)) >= 0) {
                int posNewLine;
                for (posNewLine = index; posNewLine < stop; ++posNewLine) {
                    if (body[posNewLine] == 10 || body[posNewLine] == 13) {
                        // newline
                        String line = new String(body, index, posNewLine - index, StandardCharsets.UTF_8);
                        Matcher matcher = FILENAME_PATTERN.matcher(line);
                        if (matcher.find()) {
                            filenames.add(matcher.group(1));
                        }
                        break;
                    }
                }
                start = posNewLine + 1;
            }

            start = 0;
            byte[] contentTypePattern = "Content-Type:".getBytes(StandardCharsets.UTF_8);

            while ((index = KpmAlgorithm.indexOf(body, start, stop, contentTypePattern)) >= 0) {
                int posNewLine;
                for (posNewLine = index; posNewLine < stop; ++posNewLine) {
                    if (body[posNewLine] == 10 || body[posNewLine] == 13) {
                        // newline
                        String line = new String(body, index, posNewLine - index, StandardCharsets.UTF_8);
                        Matcher matcher = CONTENT_TYPE_PATTERN.matcher(line);
                        if (matcher.find()) {
                            contentTypes.add(matcher.group(1));
                        }
                        break;
                    }
                }
                start = posNewLine + 1;
            }

            // reset the body to compensate here consuming all the data
            request.setBody(BinaryData.fromBytes(body));
            return nextPolicy.process();
        }

        private void validateFilenames(String... filenames) {
            Assertions.assertEquals(Arrays.asList(filenames), this.filenames);
        }

        private void validateContentTypes(String... contentTypes) {
            Assertions.assertEquals(Arrays.asList(contentTypes), this.contentTypes);
        }
    }

    @Test
    public void testBasic() {
        MultiPartRequest request = new MultiPartRequest("123",
            new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg"));

        client.basic(request);
    }

    @Test
    public void testJson() {
        client.jsonPart(new JsonPartRequest(new Address("X"),
            new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg")));
    }

    // JSON array removed from cadl-ranch
//    @Test
//    public void testJsonArray() {
//        client.jsonArrayParts(new JsonArrayPartsRequest(
//                new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg"),
//                Arrays.asList(new Address("Y"), new Address("Z"))));
//    }

    @Test
    public void testMultipleFiles() {
        client.multiBinaryParts(
            new MultiBinaryPartsRequest(new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg"))
                .setPicture(
                    new PictureFileDetails(BinaryData.fromFile(FileUtils.getPngFile())).setFilename("image.png")));

        validationPolicy.validateFilenames("image.jpg", "image.png");

        // "picture" be optional
        client.multiBinaryParts(new MultiBinaryPartsRequest(
            new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg")));
    }

    @Test
    public void testFileArray() {
        client.binaryArrayParts(new BinaryArrayPartsRequest("123",
            Arrays.asList(new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("image1.png"),
                new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("image2.png"))));

        validationPolicy.validateContentTypes("application/octet-stream", "application/octet-stream");

        // filename contains non-ASCII
        client.binaryArrayParts(new BinaryArrayPartsRequest("123",
            Arrays.asList(new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("voilà.png"),
                new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("ima\"\n\rge2.png"))));

        validationPolicy.validateFilenames("voilà.png", "ima%22%0A%0Dge2.png");
    }

    @Test
    public void testFilenameAndContentType() {
        client.checkFileNameAndContentType(
            new MultiPartRequest("123", new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("hello.jpg")
                .setContentType("image/jpg")));
    }

    @Test
    public void testComplex() {
        client.fileArrayAndBasic(new ComplexPartsRequest("123", new Address("X"),
            new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg"),
            Arrays.asList(new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("image1.png"),
                new PicturesFileDetails(BinaryData.fromFile(PNG_FILE)).setFilename("image2.png"))));

        validationPolicy.validateFilenames("image.jpg", "image1.png", "image2.png");
    }

    @Test
    public void testAnonymousModel() {
        client.anonymousModel(
            new AnonymousModelRequest(new ProfileImageFileDetails(BinaryData.fromFile(FILE)).setFilename("image.jpg")));
    }

    @Test
    public void testFileWithHttpPartSpecificContentType() {
        httpPartContentTypeClient.imageJpegContentType(new FileWithHttpPartSpecificContentTypeRequest(
            new FileSpecificContentType(BinaryData.fromFile(FILE), "hello.jpg")));
    }

    @Test
    public void testFileWithHttpPartRequiredContentType() {
        httpPartContentTypeClient.requiredContentType(new FileWithHttpPartRequiredContentTypeRequest(
            new FileRequiredMetaData(BinaryData.fromFile(FILE), FILENAME, "application/octet-stream")));
    }

    @Test
    public void testFileWithHttpPartOptionalContentType() {
        httpPartContentTypeClient.optionalContentType(new FileWithHttpPartOptionalContentTypeRequest(
            new FileOptionalContentType(BinaryData.fromFile(FILE), FILENAME).setContentType(FILE_CONTENT_TYPE)));
    }

    @Test
    public void testComplexWithHttpPart() {
        FormDataHttpPartsClient client
            = new MultiPartClientBuilder().addHttpPipelinePolicy(validationPolicy).buildFormDataHttpPartsClient();

        client.jsonArrayAndFileArray(new ComplexHttpPartsModelRequest("123", new Address("X"),
            new FileRequiredMetaData(BinaryData.fromFile(FILE), FILENAME, FILE_CONTENT_TYPE),
            List.of(new Address("Y"), new Address("Z")),
            List.of(new FileRequiredMetaData(BinaryData.fromFile(PNG_FILE), FILENAME + "1", FILE_CONTENT_TYPE),
                new FileRequiredMetaData(BinaryData.fromFile(PNG_FILE), FILENAME + "2", FILE_CONTENT_TYPE))));
    }

    @Test
    public void testNonStringHttpPart() {
        FormDataHttpPartsNonStringClient client = new MultiPartClientBuilder().addHttpPipelinePolicy(validationPolicy)
            .buildFormDataHttpPartsNonStringClient();

        client.floatMethod(new FloatRequest(0.5));
    }
}
