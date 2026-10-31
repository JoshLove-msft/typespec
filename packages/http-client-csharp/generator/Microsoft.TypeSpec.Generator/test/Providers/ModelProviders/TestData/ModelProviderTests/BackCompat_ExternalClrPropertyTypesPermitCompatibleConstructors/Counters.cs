using System.Collections.Generic;
using Sample.External;

namespace Sample.Models
{
    public partial class StringGenericCounter : GenericBase<string>
    {
        public StringGenericCounter(string value)
        {
            Value = value;
        }
    }

    public partial class NestedGenericCounter : GenericIntermediate<string>
    {
        public NestedGenericCounter(List<string> value)
        {
            Value = value;
        }
    }

    public partial class NullableGenericCounter : NullableGenericBase<int>
    {
        public NullableGenericCounter(int? value)
        {
            Value = value;
        }
    }

    public partial class GeneratedGenericCounter : GenericBase<ExternalValue>
    {
        public GeneratedGenericCounter(ExternalValue value)
        {
            Value = value;
        }
    }

    public partial class EnumCounter : EnumBase
    {
        public EnumCounter(ExternalKind value)
        {
            Value = value;
        }
    }

    public partial class EnumCollectionCounter : GenericBase<List<ExternalKind>>
    {
        public EnumCollectionCounter(List<ExternalKind> value)
        {
            Value = value;
        }
    }

    public partial class MismatchedGenericCounter : GenericBase<int>
    {
        public MismatchedGenericCounter(string value)
        {
            Value = int.Parse(value);
        }
    }

    public partial class MismatchedNullableCollectionCounter : GenericIntermediate<int>
    {
        public MismatchedNullableCollectionCounter(List<int?> value)
        {
            Value = value.ConvertAll(item => item.GetValueOrDefault());
        }
    }

    public partial class NullableToNonNullableCollectionCounter : GenericIntermediate<int>
    {
        public NullableToNonNullableCollectionCounter(List<int?> value)
        {
            Value = value.ConvertAll(item => item.GetValueOrDefault());
        }
    }

    public partial class NonNullableToNullableCollectionCounter : GenericIntermediate<int?>
    {
        public NonNullableToNullableCollectionCounter(List<int> value)
        {
            Value = value.ConvertAll(item => (int?)item);
        }
    }
}
