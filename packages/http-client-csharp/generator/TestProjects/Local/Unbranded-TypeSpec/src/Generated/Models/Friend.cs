// <auto-generated/>

#nullable disable

using System;
using UnbrandedTypeSpec;

namespace UnbrandedTypeSpec.Models
{
    public partial class Friend
    {
        /// <summary> Initializes a new instance of <see cref="Friend"/>. </summary>
        /// <param name="name"> name of the NotFriend. </param>
        /// <exception cref="ArgumentNullException"> <paramref name="name"/> is null. </exception>
        public Friend(string name)
        {
            Argument.AssertNotNull(name, nameof(name));

            Name = name;
        }

        /// <summary> name of the NotFriend. </summary>
        public string Name { get; set; }
    }
}
