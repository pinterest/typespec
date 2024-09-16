// <auto-generated/>

#nullable disable

using System;
using System.Collections.Generic;

namespace _Type.Model.Inheritance.SingleDiscriminator.Models
{
    public partial class Eagle : Bird
    {
        public Eagle(int wingspan) : base("eagle", wingspan) => throw null;

        internal Eagle(IList<Bird> friends, IDictionary<string, Bird> hate, Bird partner, int wingspan, IDictionary<string, BinaryData> additionalBinaryDataProperties) : base("eagle", wingspan, additionalBinaryDataProperties) => throw null;

        public IList<Bird> Friends => throw null;

        public IDictionary<string, Bird> Hate => throw null;

        public Bird Partner
        {
            get => throw null;
            set => throw null;
        }
    }
}